FROM rust:latest AS builder
WORKDIR /app
COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml
COPY ./src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/chat-service /usr/src/app
CMD ["/usr/src/app"]
