# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM rust:1.83-alpine AS backend-build
RUN apk add --no-cache musl-dev
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock* ./
# Cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY backend/src/ ./src/
COPY --from=frontend-build /app/backend/static ./static/
RUN cargo build --release

# Stage 3: Runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
COPY --from=backend-build /app/backend/target/release/pixdock /usr/local/bin/
COPY --from=backend-build /app/backend/static /static

EXPOSE 8420
WORKDIR /
ENV RUST_LOG=pixdock=info
CMD ["pixdock"]
