use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm as Argon2Algorithm, Argon2, Params, Version,
};

use axum::extract::Path;
use axum::http::HeaderValue;
use axum::routing::get;
use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::post, Json, Router};
use dotenv::dotenv;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::{env, net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    db_pool: Pool<Postgres>,
}

#[derive(Debug, Serialize, Deserialize)]
struct User {
    id: i64,
    full_name: String,
    username: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RegisterRequest {
    full_name: String,
    username: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    user_id: i64,
    full_name: String,
    username: String,
    exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    token: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db_pool = PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_secs(30))
        .max_connections(20)
        .connect(database_url.as_str())
        .await?;

    // SQL to create table if it doesn't exist (keep it very simple)
    // CREATE TABLE IF NOT EXISTS users (
    //    id SERIAL PRIMARY KEY,
    //    full_name TEXT NOT NULL,
    //    username TEXT NOT NULL UNIQUE,
    //    hashed_password TEXT NOT NULL
    // );
    // Run this in your own migration or maintain externally.

    // let cors = CorsLayer::new()
    //     .allow_origin("localhost".parse::<HeaderValue>().unwrap())
    //     .allow_methods([Method::POST])
    //     .allow_headers([
    //         AUTHORIZATION,
    //         http::header::ACCEPT,
    //         http::header::CONTENT_TYPE,
    //     ])
    //     .allow_credentials(true);

    let origins = env::var("CORS_ORIGIN").unwrap();
    let origins: Vec<HeaderValue> = origins
        .split(',')
        .map(|h| h.trim().parse().unwrap())
        .collect();

    let cors = CorsLayer::very_permissive().allow_origin(origins);

    let app_state = Arc::new(AppState { db_pool });

    let app = Router::new()
        .route("/register", post(register_user))
        .route("/login", post(login_user))
        .route("/user/{username}", get(get_user_details))
        .layer(cors)
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    println!("User-service listening on {}", addr);
    axum::serve(TcpListener::bind(addr).await?, app.into_make_service()).await?;
    Ok(())
}

async fn register_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> impl IntoResponse {
    let salt = SaltString::generate(&mut OsRng);
    let secret_key = env::var("PASSWORD_SECRET").unwrap().as_bytes().to_owned();
    let argon2 = Argon2::new_with_secret(
        &secret_key,
        Argon2Algorithm::Argon2id,
        Version::V0x13,
        Params::default(),
    )
    .unwrap();
    let hashed_password = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .unwrap();

    let row = sqlx::query_as!(
        User,
        r#"
        INSERT INTO users (full_name, username, hashed_password)
        VALUES ($1, $2, $3)
        RETURNING id, full_name, username
        "#,
        payload.full_name,
        payload.username,
        hashed_password
    )
    .fetch_one(&state.db_pool)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, format!("User insert error: {}", e)))?;

    Ok::<_, (StatusCode, String)>(Json(row))
}

async fn login_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    let user = sqlx::query!(
        r#"
        SELECT id, full_name, username, hashed_password
        FROM users
        WHERE username = $1
        "#,
        payload.username
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error"))?;

    let Some(u) = user else {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials"));
    };

    let parsed_hash = PasswordHash::new(u.hashed_password.as_str())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Hash parse error"))?;
    let secret_key = env::var("PASSWORD_SECRET").unwrap().as_bytes().to_owned();

    Argon2::new_with_secret(
        &secret_key,
        Argon2Algorithm::Argon2id,
        Version::V0x13,
        Params::default(),
    )
    .unwrap()
    .verify_password(payload.password.as_bytes(), &parsed_hash)
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid password"))?;

    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .unwrap()
        .timestamp() as usize;
    let claims = Claims {
        user_id: u.id as i64,
        full_name: u.full_name,
        username: u.username,
        exp: expiration,
    };

    let jwt_secret = env::var("TOKEN_SECRET").unwrap();
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Token creation error"))?;

    Ok::<_, (StatusCode, &'static str)>(Json(TokenResponse { token }))
}

async fn get_user_details(
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
) -> impl IntoResponse {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, full_name, username
        FROM users
        WHERE username = $1
        "#,
        username
    )
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error"))?;

    match user {
        Some(user) => Ok(Json(user)),
        None => Err((StatusCode::NOT_FOUND, "User not found")),
    }
}
