FROM rust:latest AS builder
WORKDIR /app
COPY ./Cargo.lock ./Cargo.lock
COPY ./Cargo.toml ./Cargo.toml
COPY ./src ./src
COPY ./.sqlx ./.sqlx
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt install -y openssl ca-certificates wget curl && rm -rf /var/lib/apt/lists/*

ENV CLOUD_SQL_PROXY_VERSION=2.15.0
RUN curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64 && \
    chmod +x cloud-sql-proxy && \
    mv cloud-sql-proxy /usr/local/bin/

COPY --from=builder /app/target/release/user-service /usr/src/app

EXPOSE 8080
#CMD ["/usr/src/app"]

CMD /usr/local/bin/cloud-sql-proxy \
      eastern-kit-447119-p5:europe-west3:acs-final-db \
      --auto-iam-authn=false \
      --address=0.0.0.0 \
      --port=5432 & \
    /usr/src/app
