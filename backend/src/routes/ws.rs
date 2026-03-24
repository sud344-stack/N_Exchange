use crate::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use std::time::Duration;
use tokio::time::interval;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut ticker = interval(Duration::from_millis(100));

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                let mut prices = serde_json::Map::new();
                for entry in state.market_data.prices.iter() {
                    prices.insert(entry.key().clone(), serde_json::json!(*entry.value()));
                }

                if !prices.is_empty() {
                    let payload = serde_json::json!({
                        "type": "prices",
                        "data": prices
                    });
                    
                    if socket.send(Message::Text(payload.to_string().into())).await.is_err() {
                        // client disconnected
                        return;
                    }
                }
            }
            msg = socket.recv() => {
                if let Some(Ok(Message::Close(_))) = msg {
                    return;
                }
            }
        }
    }
}
