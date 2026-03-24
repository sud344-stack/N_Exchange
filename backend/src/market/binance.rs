use dashmap::DashMap;
use futures_util::StreamExt;
use serde::Deserialize;
use std::sync::Arc;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info, warn};

#[derive(Debug, Deserialize)]
struct BinanceTickerMessage {
    #[serde(rename = "s")]
    symbol: String,
    #[serde(rename = "c")]
    price: String,
}

pub struct MarketData {
    pub prices: Arc<DashMap<String, f64>>,
}

impl MarketData {
    pub fn new() -> Self {
        Self {
            prices: Arc::new(DashMap::new()),
        }
    }

    pub async fn start_binance_websocket(&self) {
        let prices = self.prices.clone();
        
        // Binance specific stream. We use lowercase as required by binance wss
        // Coins: BTC, XRP, BNB, ETH, SOL, POL, XMR, ZCASH, PEPE
        let streams = "btcusdt@ticker/xrpusdt@ticker/bnbusdt@ticker/ethusdt@ticker/solusdt@ticker/polusdt@ticker/xmrusdt@ticker/zecusdt@ticker/pepeusdt@ticker";
        let url = format!("wss://data-stream.binance.vision:9443/ws/{}", streams);

        tokio::spawn(async move {
            loop {
                info!("Connecting to Binance WebSocket: {}", url);
                match connect_async(&url).await {
                    Ok((ws_stream, _)) => {
                        info!("Connected to Binance WebSocket");
                        let (_, mut read) = ws_stream.split();

                        while let Some(msg) = read.next().await {
                            match msg {
                                Ok(Message::Text(text)) => {
                                    if let Ok(ticker) = serde_json::from_str::<BinanceTickerMessage>(&text) {
                                        if let Ok(price) = ticker.price.parse::<f64>() {
                                            prices.insert(ticker.symbol, price);
                                        }
                                    }
                                }
                                Ok(Message::Close(_)) => {
                                    warn!("Binance WebSocket closed, reconnecting...");
                                    break;
                                }
                                Err(e) => {
                                    error!("Binance WebSocket error: {:?}", e);
                                    break;
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to connect to Binance WebSocket: {:?}. Retrying in 5 seconds...", e);
                    }
                }
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        });
    }
}
