# Codebase Notes

### backend/src/main.rs
- **Role**: Entry point for the backend Rust server.
- **Key Details**:
    - Initializes an `AppState` holding the database connection pool (`sqlx::PgPool`) and `market::binance::MarketData` (real-time Binance WebSocket data).
    - Initializes `db::init_db()`.
    - Instantiates a `market_data` module to capture live market data.
    - Initializes the `engine::MatchingEngine::new(state.clone())` and spawns it onto a new Tokio asynchronous task (`tokio::spawn(async move { engine.run().await; })`). This implies a continuous loop running inside `MatchingEngine::run`.
    - Sets up the `axum` router serving HTTP API routes (`/health`, `/api/users`, `/api/users/{user_id}/portfolio`, `/api/orders`), WebSocket routes (`/ws`), and fallback to serve frontend static files from `../frontend/dist`.
    - Uses CORS allowing anything (`Any`).

### backend/src/engine/mod.rs (Matching Engine)
- **Role**: The core logic simulating the trading environment.
- **Key Details**:
    - **Loop Execution**: A single Tokio task running continuously every 500ms (`tokio::time::interval(Duration::from_millis(500))`).
    - **Matching Logic (`match_orders`)**:
        - Selects all open orders from PostgreSQL using a simple query: `SELECT * FROM orders WHERE status = 'OPEN'`.
        - Iterates over the selected open orders linearly.
        - Checks the live price obtained from a `DashMap` (Binance WebSocket feed: `self.state.market_data.prices.get(&symbol)`).
        - Executes MARKET orders instantly.
        - Executes LIMIT BUY orders if the current live price <= order price.
        - Executes LIMIT SELL orders if the current live price >= order price.
    - **Execution (`execute_trade`)**:
        - Initiates a database transaction (`self.state.db.begin().await?`).
        - Sets the order status to `FILLED`.
        - Updates the user's portfolio for the traded asset using an `INSERT ... ON CONFLICT DO UPDATE` query (adds/subtracts asset).
        - Updates the user's USDT balance based on the executed price.
        - Commits the transaction.
- **Initial Critique Notes**:
    - **Not a real matching engine**: This is an *execution engine* against a live external price feed (Binance), not a true peer-to-peer limit order book matching engine (like Nasdaq/Binance). It acts as an AMM (Automated Market Maker) or broker simulator against real world prices, filling orders regardless of liquidity on the other side.
    - **Database Heavy**: Polling the database for `OPEN` orders every 500ms doesn't scale. Real matching engines hold order books in memory (RAM) and only persist to DB asynchronously.
    - **No Partial Fills**: Orders are completely filled or not filled.
    - **No Slippage/Impact**: Market orders execute exactly at the current mid-price without affecting the spread.

### backend/src/db/mod.rs
- **Role**: Database connection and migration runner.
- **Key Details**:
    - Creates a `PgPool` with `max_connections(5)`.
    - Automatically runs SQLx migrations on startup (`sqlx::migrate!().run(&pool).await`).

### backend/src/models/mod.rs
- **Role**: Definitions of core data structures mapped to PostgreSQL.
- **Key Details**:
    - Defines `User` (`id`, `username`, `created_at`).
    - Defines `Portfolio` (`id`, `user_id`, `asset`, `balance`, `created_at`, `updated_at`). Balances are stored as `BigDecimal`.
    - Defines `Order` (`id`, `user_id`, `asset`, `side`, `order_type`, `price`, `quantity`, `status`, `created_at`, `updated_at`). Fields like `price` and `quantity` are `BigDecimal`.
    - Defines `TickerData` (`symbol`, `price`).

### backend/src/market/mod.rs & binance.rs
- **Role**: Ingests real-time market data (tickers and order books) from Binance.
- **Key Details**:
    - Connects to `wss://data-stream.binance.vision:9443/stream` using a combined stream of tickers (`<coin>@ticker`) and depth (`<coin>@depth20@100ms`).
    - Supported coins: BTC, XRP, BNB, ETH, SOL, POL, XMR, ZEC, PEPE.
    - Stores live prices (`f64`) in a `DashMap<String, f64>`.
    - Stores live order books (top 20 bids/asks) in a `DashMap<String, OrderBook>`.
    - Spawns a dedicated Tokio task that runs an infinite reconnect loop to process WebSocket messages.
- **Initial Critique Notes**:
    - Instead of having its own internal limit order book and order matching, the platform acts entirely as a shadow/paper-trading layer over Binance's data. This essentially simulates a broker or a "b-book" exchange rather than a true exchange where buyers and sellers meet directly.


### backend/src/routes/api.rs
- **Role**: REST API route handlers.
- **Key Details**:
    - `create_user`: Creates a user or returns the existing user. Seed users with `10000.0` USDT.
    - `get_portfolio`: Fetches user portfolios by user ID.
    - `create_order`: Inserts an order with `status = 'OPEN'`.
- **Initial Critique Notes**:
    - **No Balance Check (`create_order`)**: The code explicitly notes "In a real app we would check balances here before allowing the order. For this prototype, we'll allow it and assume they have enough." This is a major security/architectural flaw compared to a professional exchange. If it were a real exchange, margin/portfolio checks MUST happen before order placement.
    - **Synchronous Database Writes on Order Path**: `create_order` performs a synchronous SQL `INSERT` to PostgreSQL. In high-frequency matching engines (Nasdaq/Binance), order placement goes straight to memory/message-queues to achieve sub-millisecond latencies, and DB persistence is asynchronous.

### backend/src/routes/ws.rs
- **Role**: WebSocket handler pushing real-time market data to connected frontends.
- **Key Details**:
    - Uses `axum::extract::ws::WebSocketUpgrade`.
    - Every 100ms (`tokio::time::interval(Duration::from_millis(100))`), it iterates over the entire `state.market_data.prices` and `state.market_data.orderbooks` maps, serializes them to JSON, and sends them to the connected client.
- **Initial Critique Notes**:
    - **Inefficient Broadcasting**: It spawns an interval loop for *each* connected client, individually locking/iterating the DashMap, serializing to JSON, and sending. For large numbers of clients, this will choke the CPU and cause huge memory overhead. A professional system uses a single broadcast channel (e.g. `tokio::sync::broadcast`) that serializes the message once and fans it out to all subscribers.


### frontend/src/context/MarketContext.tsx
- **Role**: React context providing real-time `prices` and `orderbooks` to the whole app.
- **Key Details**:
    - Connects a WebSocket to the backend (`/ws`).
    - Listens for `{ type: 'prices', data: ... }` and `{ type: 'orderbooks', data: ... }`.
    - Updates React state (`setPrices`, `setOrderbooks`) dynamically based on incoming JSON payloads.
    - Implements a basic auto-reconnect strategy (`setTimeout(connectWebSocket, 3000)`).

### frontend/src/components/OrderBook.tsx
*(Inferred from Dashboard usage)*
- **Role**: Visualizes the bids and asks for the selected trading pair.
- **Key Details**:
    - Takes a `symbol` prop (e.g., `BTCUSDT`).
    - Connects to the `MarketContext` to pull the latest `orderbooks` data.
    - Likely renders two lists: red asks descending, and green bids descending/ascending.

### frontend/src/pages/Dashboard.tsx
- **Role**: The main trading UI.
- **Key Details**:
    - Uses `MarketContext` for live prices.
    - Uses an interval (`setInterval(fetchPortfolio, 2000)`) to poll the backend (`/api/users/{userId}/portfolio`) for the user's balances.
    - Displays a TradingView widget (inferred from imports/naming convention) or a custom chart `TradingChart.tsx`.
    - Handles form submissions for BUY/SELL, LIMIT/MARKET orders, and POSTs them to `/api/orders`.
    - Contains a "Portfolio" section visualizing the user's assets and converting them to USDT equivalents based on live prices.
- **Initial Critique Notes**:
    - **UI/UX mismatch**: The frontend provides a professional-looking UI, but the underlying engine behaves differently than what the UI implies. For example, placing a limit order does not put that order into the visible order book (`OrderBook.tsx` shows Binance's book, not local open orders).
    - **Polling**: Polling `/portfolio` every 2 seconds is inefficient. Professional exchanges push balance updates via WebSocket.
