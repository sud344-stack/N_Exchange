mod db;
mod models;
mod routes;
mod engine;
mod market;

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use market::binance::MarketData;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<sqlx::PgPool>,
    pub market_data: Arc<market::binance::MarketData>,
}

#[tokio::main]
async fn main() {
    // initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=debug,axum::rejection=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load .env
    dotenvy::dotenv().ok();

    // Initialize Database
    let pool = db::init_db().await;
    
    // Initialize Market Data
    let market_data = MarketData::new();
    market_data.start_binance_websocket().await;

    let state = AppState {
        db: Arc::new(pool),
        market_data: Arc::new(market_data),
    };

    // Initialize Matching Engine
    let engine = engine::MatchingEngine::new(state.clone());
    tokio::spawn(async move {
        engine.run().await;
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Setup router
    let app = Router::new().fallback_service( tower_http::services::ServeDir::new("../frontend/dist"))
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(routes::ws::ws_handler))
        .route("/api/users", post(routes::api::create_user))
        .route("/api/users/{user_id}/portfolio", get(routes::api::get_portfolio))
        .route("/api/orders", post(routes::api::create_order))
        .layer(cors)
        .with_state(state);

    // Run server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
