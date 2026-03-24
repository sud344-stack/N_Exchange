use crate::models::Portfolio;
use crate::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use bigdecimal::{BigDecimal, FromPrimitive};

#[derive(Deserialize)]
pub struct CreateUserPayload {
    pub username: String,
}

pub async fn create_user(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserPayload>,
) -> impl IntoResponse {
    // First, check if the user already exists
    let existing_user = sqlx::query(
        r#"
        SELECT id FROM users WHERE username = $1
        "#,
    )
    .bind(&payload.username)
    .fetch_optional(&*state.db) // fetch_optional doesn't need to strictly check schema at compile time
    .await;

    match existing_user {
        Ok(Some(row)) => {
            use sqlx::Row;
            let user_id: Uuid = row.try_get("id").unwrap_or_else(|_| Uuid::nil());
            return (StatusCode::OK, Json(serde_json::json!({ "id": user_id, "username": payload.username })));
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
        Ok(None) => {} // User does not exist, proceed to create
    }

    let id = Uuid::new_v4();

    let result = sqlx::query(
        r#"
        INSERT INTO users (id, username)
        VALUES ($1, $2)
        "#
    )
    .bind(id)
    .bind(&payload.username)
    .execute(&*state.db)
    .await;

    match result {
        Ok(_) => {
            // Give them some starting paper money (USDT)
            let _ = sqlx::query(
                r#"
                INSERT INTO portfolios (id, user_id, asset, balance)
                VALUES ($1, $2, 'USDT', $3)
                "#
            )
            .bind(Uuid::new_v4())
            .bind(id)
            .bind(BigDecimal::from_f64(10000.0).unwrap_or_default())
            .execute(&*state.db)
            .await;

            (StatusCode::CREATED, Json(serde_json::json!({ "id": id, "username": payload.username })))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

pub async fn get_portfolio(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query_as::<_, Portfolio>(
        r#"
        SELECT id, user_id, asset, balance, created_at, updated_at
        FROM portfolios
        WHERE user_id = $1
        "#
    )
    .bind(user_id)
    .fetch_all(&*state.db)
    .await;

    match result {
        Ok(portfolio) => (StatusCode::OK, Json(serde_json::json!(portfolio))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

#[derive(Deserialize)]
pub struct CreateOrderPayload {
    pub user_id: Uuid,
    pub asset: String,
    pub side: String, // BUY or SELL
    pub order_type: String, // LIMIT or MARKET
    pub price: f64,
    pub quantity: f64,
}

pub async fn create_order(
    State(state): State<AppState>,
    Json(payload): Json<CreateOrderPayload>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();

    // In a real app we would check balances here before allowing the order.
    // For this prototype, we'll allow it and assume they have enough.

    let result = sqlx::query(
        r#"
        INSERT INTO orders (id, user_id, asset, side, type, price, quantity, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
        "#
    )
    .bind(id)
    .bind(payload.user_id)
    .bind(payload.asset)
    .bind(payload.side)
    .bind(payload.order_type)
    .bind(BigDecimal::from_f64(payload.price).unwrap_or_default())
    .bind(BigDecimal::from_f64(payload.quantity).unwrap_or_default())
    .execute(&*state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({ "id": id }))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}
