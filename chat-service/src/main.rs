use axum::{
    extract::{Form, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{get, post},
    Json, Router,
};
use dotenv::dotenv;
use futures::stream::Stream;
use http::header::AUTHORIZATION;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use rustls::crypto::ring::default_provider;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    convert::Infallible,
    env,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, SystemTime},
};
use tokio::net::TcpListener;
use tokio::{
    sync::{
        broadcast::{self, Sender},
        Mutex,
    },
    time::sleep,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

const INACTIVE_THRESHOLD: Duration = Duration::from_secs(30);
const CLEANUP_INTERVAL: Duration = Duration::from_secs(30);
const CHANNEL_CAPACITY: usize = 1024;
const MAX_MESSAGE_LENGTH: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Claims {
    user_id: i64,
    full_name: String,
    username: String,
    exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum MessageType {
    UserJoined,
    UserLeft,
    Chat,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Message {
    room: String,
    message: String,
    timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    message_type: Option<MessageType>,
    username: String,
}

#[derive(Debug, Clone)]
struct UserInfo {
    last_seen: SystemTime,
    room: String,
}

struct AppState {
    tx: Sender<Message>,
    users: Mutex<HashMap<String, UserInfo>>, // (username, UserInfo)
    rooms: Mutex<HashSet<String>>,
}

#[derive(Debug, Deserialize)]
struct HeartbeatData {
    room: String,
}

#[derive(Debug, Deserialize)]
struct RoomData {
    room: String,
}

impl AppState {
    async fn broadcast_system_message(&self, text: &str) {
        let sys_msg = Message {
            room: "system".to_string(),
            message: text.to_string(),
            timestamp: chrono::Utc::now().timestamp(),
            message_type: Some(MessageType::System),
            username: "System".to_string(),
        };
        let _ = self.tx.send(sys_msg);
    }

    async fn remove_user(&self, username: String, reason: &str) {
        let mut users = self.users.lock().await;
        if users.remove(&username).is_some() {
            let text = format!("User {} disconnected: {}", username, reason);
            drop(users);
            self.broadcast_system_message(&text).await;
        }
    }
}

async fn cleanup_inactive_users(state: Arc<AppState>) {
    loop {
        sleep(CLEANUP_INTERVAL).await;
        let users = state.users.lock().await;
        let now = SystemTime::now();
        let inactive: Vec<String> = users
            .iter()
            .filter(|(_, info)| {
                now.duration_since(info.last_seen)
                    .map(|d| d > INACTIVE_THRESHOLD)
                    .unwrap_or(true)
            })
            .map(|(uid, _)| uid.clone())
            .collect();
        drop(users);

        for uid in inactive {
            state.remove_user(uid, "inactivity").await;
        }
    }
}

async fn decode_jwt_from_header(headers: &HeaderMap) -> Result<Claims, (StatusCode, &'static str)> {
    let Some(auth_header) = headers.get(AUTHORIZATION) else {
        return Err((StatusCode::UNAUTHORIZED, "Missing Authorization header"));
    };
    let auth_str = auth_header
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid header value"))?;
    if !auth_str.starts_with("Bearer ") {
        return Err((StatusCode::UNAUTHORIZED, "Invalid token scheme"));
    }

    let jwt_secret = env::var("TOKEN_SECRET").unwrap();
    let token = &auth_str[7..];
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid or expired token"))?;
    Ok(token_data.claims)
}

async fn heartbeat(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(data): Json<HeartbeatData>,
) -> impl IntoResponse {
    match decode_jwt_from_header(&headers).await {
        Ok(claims) => {
            let mut users = state.users.lock().await;
            if let Some(user_info) = users.get_mut(&claims.username) {
                user_info.last_seen = SystemTime::now();
                user_info.room = data.room;
                (StatusCode::OK, "all ok")
            } else {
                (StatusCode::NOT_FOUND, "not found")
            }
        }
        Err(e) => e,
    }
}

async fn post_message(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Form(mut msg): Form<Message>,
) -> impl IntoResponse {
    // Decode token to get user_id
    let claims_res = decode_jwt_from_header(&headers).await;
    let Ok(claims) = claims_res else {
        return claims_res.err().unwrap();
    };

    if msg.message.len() > MAX_MESSAGE_LENGTH {
        return (StatusCode::BAD_REQUEST, "message too long");
    }

    msg.username = claims.username.clone();
    msg.timestamp = chrono::Utc::now().timestamp();
    msg.message_type = Some(MessageType::Chat);

    let mut users = state.users.lock().await;
    if let Some(u) = users.get_mut(&claims.username.clone()) {
        u.last_seen = SystemTime::now();
        u.room = msg.room.clone();
    } else {
        users.insert(
            claims.username.clone(),
            UserInfo {
                last_seen: SystemTime::now(),
                room: msg.room.clone(),
            },
        );
        let join_msg = Message {
            room: msg.room.clone(),
            message: format!("{} joined the room", claims.username),
            timestamp: chrono::Utc::now().timestamp(),
            message_type: Some(MessageType::UserJoined),
            username: claims.username,
        };
        let _ = state.tx.send(join_msg);
    }
    drop(users);

    let _ = state.tx.send(msg);
    (StatusCode::OK, "all ok")
}

async fn add_room(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RoomData>,
) -> impl IntoResponse {
    match decode_jwt_from_header(&headers).await {
        Ok(_claims) => {
            let mut rooms = state.rooms.lock().await;

            if rooms.contains(&payload.room) {
                return (StatusCode::CONFLICT, "Room already exists");
            }

            rooms.insert(payload.room.clone());

            let text = format!("New room created: {}", payload.room);
            state.broadcast_system_message(&text).await;

            (StatusCode::OK, "Room added successfully")
        }
        Err(e) => e,
    }
}

async fn list_rooms(State(state): State<Arc<AppState>>, headers: HeaderMap) -> impl IntoResponse {
    match decode_jwt_from_header(&headers).await {
        Ok(_claims) => {
            let rooms_guard = state.rooms.lock().await;
            let room_list: Vec<String> = rooms_guard.iter().cloned().collect();

            (StatusCode::OK, Json(room_list))
        }
        Err(e) => {
            let return_error = e;
            (return_error.0, Json(vec![return_error.1.to_string()]))
        }
    }
}

async fn events_handler(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, &'static str)> {
    let _ = decode_jwt_from_header(&headers).await?;

    let rx = state.tx.subscribe();
    let stream = async_stream::try_stream! {
        let mut rx = rx;
        while let Ok(msg) = rx.recv().await {
            yield Event::default().json_data(msg).unwrap();
        }
    };
    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    default_provider()
        .install_default()
        .expect("Failed to install crypto provider");

    dotenv().ok();

    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "chat_server=debug,tower_http=debug,axum::rejection=trace".into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let (tx, _rx) = broadcast::channel::<Message>(CHANNEL_CAPACITY);
    let state = Arc::new(AppState {
        tx,
        users: Mutex::new(HashMap::new()),
        rooms: Mutex::new(HashSet::new()),
    });

    let cleanup_state = state.clone();
    tokio::spawn(async move {
        cleanup_inactive_users(cleanup_state).await;
    });

    let cors = CorsLayer::very_permissive();

    let app = Router::new()
        .route("/message", post(post_message))
        .route("/heartbeat", post(heartbeat))
        .route("/events", get(events_handler))
        .route("/rooms", get(list_rooms).post(add_room))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Use self-signed certs or any valid cert for TLS
    // let config = RustlsConfig::from_pem_file(
    //     PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    //         .join("self_signed_certs")
    //         .join("cert.pem"),
    //     PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    //         .join("self_signed_certs")
    //         .join("key.pem"),
    // )
    // .await?;

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    info!("chat-service listening on {}", addr);

    // axum_server::bind_rustls(addr, config)
    //     .serve(app.into_make_service())
    //     .await?;

    axum::serve(TcpListener::bind(addr).await?, app.into_make_service()).await?;

    Ok(())
}
