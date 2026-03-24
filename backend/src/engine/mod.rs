use crate::models::Order;
use crate::AppState;
use bigdecimal::{BigDecimal, FromPrimitive};
use tokio::time::{interval, Duration};
use tracing::{error, info};

pub struct MatchingEngine {
    state: AppState,
}

impl MatchingEngine {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    pub async fn run(&self) {
        let mut interval = interval(Duration::from_millis(500)); // Run every 500ms

        loop {
            interval.tick().await;

            if let Err(e) = self.match_orders().await {
                error!("Error matching orders: {}", e);
            }
        }
    }

    async fn match_orders(&self) -> Result<(), sqlx::Error> {
        // Fetch all OPEN orders using dynamic queries since we don't have a live DB for compile-time checks here
        let orders: Vec<Order> = sqlx::query_as::<_, Order>(
            r#"
            SELECT id, user_id, asset, side, type as order_type, price, quantity, status, created_at, updated_at
            FROM orders
            WHERE status = 'OPEN'
            "#
        )
        .fetch_all(&*self.state.db)
        .await?;

        for order in orders {
            let symbol = format!("{}USDT", order.asset);
            
            // Get current price from our DashMap (Binance feed)
            if let Some(current_price_ref) = self.state.market_data.prices.get(&symbol) {
                let current_price_f64 = *current_price_ref;
                let current_price = BigDecimal::from_f64(current_price_f64).unwrap_or_default();
                let mut should_execute = false;

                // Match logic
                if order.order_type == "MARKET" {
                    should_execute = true;
                } else if order.order_type == "LIMIT" {
                    if order.side == "BUY" && current_price <= order.price {
                        should_execute = true;
                    } else if order.side == "SELL" && current_price >= order.price {
                        should_execute = true;
                    }
                }

                if should_execute {
                    // Execute trade (Transaction)
                    self.execute_trade(&order, current_price_f64).await?;
                }
            }
        }

        Ok(())
    }

    async fn execute_trade(&self, order: &Order, execute_price: f64) -> Result<(), sqlx::Error> {
        let mut tx = self.state.db.begin().await?;

        // 1. Update order status to FILLED
        sqlx::query(
            r#"
            UPDATE orders SET status = 'FILLED', updated_at = NOW() WHERE id = $1
            "#
        )
        .bind(order.id)
        .execute(&mut *tx)
        .await?;

        // 2. Update user portfolio for the Asset (BTC, ETH, etc)
        // If they are buying, add to their balance
        // If they are selling, subtract from their balance
        
        let quantity_change = if order.side == "BUY" {
            order.quantity.clone()
        } else {
            -order.quantity.clone()
        };

        sqlx::query(
            r#"
            INSERT INTO portfolios (id, user_id, asset, balance)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, asset)
            DO UPDATE SET balance = portfolios.balance + EXCLUDED.balance, updated_at = NOW()
            "#
        )
        .bind(uuid::Uuid::new_v4())
        .bind(order.user_id)
        .bind(&order.asset)
        .bind(&quantity_change)
        .execute(&mut *tx)
        .await?;

        // 3. Update USDT balance
        // Buy: lose USDT = execute_price * quantity
        // Sell: gain USDT = execute_price * quantity
        let execute_price_bd = BigDecimal::from_f64(execute_price).unwrap_or_default();
        let usdt_change = if order.side == "BUY" {
            -(execute_price_bd * order.quantity.clone())
        } else {
            execute_price_bd * order.quantity.clone()
        };

        sqlx::query(
            r#"
            INSERT INTO portfolios (id, user_id, asset, balance)
            VALUES ($1, $2, 'USDT', $3)
            ON CONFLICT (user_id, asset)
            DO UPDATE SET balance = portfolios.balance + EXCLUDED.balance, updated_at = NOW()
            "#
        )
        .bind(uuid::Uuid::new_v4())
        .bind(order.user_id)
        .bind(&usdt_change)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        info!("Executed order {} for user {} at price {}", order.id, order.user_id, execute_price);

        Ok(())
    }
}
