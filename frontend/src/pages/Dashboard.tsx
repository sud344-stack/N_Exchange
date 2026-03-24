import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useMarketHook } from '../context/MarketContext';
import TradingChart from '../components/TradingChart';
import OrderBookComponent from '../components/OrderBook';

interface PortfolioItem {
  asset: string;
  balance: number;
}

const availableAssets = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'POL', 'XMR', 'ZEC', 'PEPE'];

export const Dashboard: React.FC = () => {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const { prices } = useMarketHook();

  const [orderSide, setOrderSide] = useState('BUY');
  const [orderAsset, setOrderAsset] = useState('BTC');
  const [orderType, setOrderType] = useState('MARKET');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');

  const fetchPortfolio = useCallback(async (id: string) => {
    try {
      const res = await axios.get(`/api/users/${id}/portfolio`);
      setPortfolio(res.data);
    } catch (e) {
      console.error("Failed to fetch portfolio", e);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchPortfolio(userId);
      const interval = setInterval(() => fetchPortfolio(userId), 2000);
      return () => clearInterval(interval);
    }
  }, [userId, fetchPortfolio]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/users', { username });
      const id = res.data.id;
      setUserId(id);
      localStorage.setItem('userId', id);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleLogout = () => {
    setUserId(null);
    localStorage.removeItem('userId');
    setPortfolio([]);
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const payload = {
      user_id: userId,
      asset: orderAsset,
      side: orderSide,
      order_type: orderType,
      price: orderType === 'MARKET' ? 0 : parseFloat(orderPrice),
      quantity: parseFloat(orderQuantity)
    };

    try {
      await axios.post('/api/orders', payload);
      alert('Order placed successfully!');
      setOrderQuantity('');
      if(orderType === 'LIMIT') setOrderPrice('');
      fetchPortfolio(userId);
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      alert(`Order failed: ${((e as any).response?.data?.error) || (e as any).message}`);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-mono">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-800 w-96 max-w-full">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-500">N_Exchange</h2>
          <div className="mb-4">
            <label className="block text-zinc-400 text-sm mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter username..."
              required
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition-colors shadow-lg shadow-blue-900/20">
            Start Trading
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center bg-zinc-900 px-6 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-500 tracking-wider">N_Exchange</h1>
          <nav className="hidden md:flex gap-4">
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Markets</a>
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Trade</a>
            <a href="#" className="text-sm font-medium hover:text-blue-400 transition-colors">Derivatives</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 rounded-full border border-zinc-700/50">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs text-zinc-300 font-medium">Binance WSS Live</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">Logout</button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 grid grid-cols-12 gap-[1px] bg-zinc-800 overflow-hidden">

        {/* Left Column: Market Data (Asset selector) */}
        <aside className="col-span-2 bg-zinc-950 flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 shrink-0">
            <h2 className="text-sm font-bold text-zinc-100">Markets</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {availableAssets.map((asset) => {
              const symbol = `${asset}USDT`;
              const price = prices[symbol];
              const isSelected = orderAsset === asset;

              return (
                <button
                  key={asset}
                  onClick={() => setOrderAsset(asset)}
                  className={`w-full text-left flex justify-between items-center p-2 rounded transition-all duration-200 group ${
                    isSelected ? 'bg-zinc-800 border-l-2 border-blue-500' : 'hover:bg-zinc-900 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>{asset}</span>
                    <span className="text-[10px] text-zinc-600">/USDT</span>
                  </div>
                  <span className={`font-mono text-xs ${price ? (isSelected ? 'text-green-400' : 'text-zinc-400') : 'text-zinc-600'}`}>
                    {price ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}` : '...'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Middle Column: Chart & Trading Form */}
        <div className="col-span-7 flex flex-col h-full bg-zinc-950 overflow-hidden">
          {/* Chart Section */}
          <div className="flex-1 relative border-b border-zinc-800 min-h-[50%]">
            <TradingChart symbol={`${orderAsset}USDT`} />
          </div>

          {/* Trade Form Section */}
          <div className="h-64 bg-zinc-900 shrink-0 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100">Spot Trade</h2>
              <div className="text-xs text-zinc-500">
                Wallet Balance: <span className="font-mono text-zinc-300">{portfolio.find(p => p.asset === 'USDT')?.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'} USDT</span>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <form onSubmit={submitOrder} className="flex gap-6 max-w-3xl mx-auto">
                {/* Buy Side */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-zinc-800/50 rounded p-1 border border-zinc-700/50">
                    <button type="button" onClick={() => {setOrderSide('BUY'); setOrderType('LIMIT');}} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${orderSide === 'BUY' && orderType === 'LIMIT' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'}`}>Limit</button>
                    <button type="button" onClick={() => {setOrderSide('BUY'); setOrderType('MARKET');}} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${orderSide === 'BUY' && orderType === 'MARKET' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'}`}>Market</button>
                  </div>

                  {orderType === 'LIMIT' ? (
                    <div className="relative">
                      <input
                        type="number" step="any" required disabled={orderSide !== 'BUY'}
                        value={orderSide === 'BUY' ? orderPrice : ''}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-green-500 outline-none text-right pr-12 placeholder-zinc-700 transition-colors disabled:opacity-50"
                        placeholder="Price"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">USDT</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text" disabled
                        className="w-full bg-zinc-950/50 text-zinc-500 border border-zinc-800/50 rounded px-3 py-2 text-sm text-center italic cursor-not-allowed"
                        placeholder="Market Price"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="number" step="any" required disabled={orderSide !== 'BUY'}
                      value={orderSide === 'BUY' ? orderQuantity : ''}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-green-500 outline-none text-right pr-12 placeholder-zinc-700 transition-colors disabled:opacity-50"
                      placeholder="Amount"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">{orderAsset}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={orderSide !== 'BUY'}
                    className={`w-full py-2.5 rounded font-bold tracking-wider text-sm transition-all duration-200 mt-auto ${
                      orderSide === 'BUY'
                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50'
                    }`}
                  >
                    Buy {orderAsset}
                  </button>
                </div>

                {/* Sell Side */}
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-zinc-800/50 rounded p-1 border border-zinc-700/50">
                    <button type="button" onClick={() => {setOrderSide('SELL'); setOrderType('LIMIT');}} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${orderSide === 'SELL' && orderType === 'LIMIT' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'}`}>Limit</button>
                    <button type="button" onClick={() => {setOrderSide('SELL'); setOrderType('MARKET');}} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${orderSide === 'SELL' && orderType === 'MARKET' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300'}`}>Market</button>
                  </div>

                  {orderType === 'LIMIT' ? (
                    <div className="relative">
                      <input
                        type="number" step="any" required disabled={orderSide !== 'SELL'}
                        value={orderSide === 'SELL' ? orderPrice : ''}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-red-500 outline-none text-right pr-12 placeholder-zinc-700 transition-colors disabled:opacity-50"
                        placeholder="Price"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">USDT</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text" disabled
                        className="w-full bg-zinc-950/50 text-zinc-500 border border-zinc-800/50 rounded px-3 py-2 text-sm text-center italic cursor-not-allowed"
                        placeholder="Market Price"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <input 
                      type="number" step="any" required disabled={orderSide !== 'SELL'}
                      value={orderSide === 'SELL' ? orderQuantity : ''}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      className="w-full bg-zinc-950 text-white border border-zinc-800 rounded px-3 py-2 text-sm focus:border-red-500 outline-none text-right pr-12 placeholder-zinc-700 transition-colors disabled:opacity-50"
                      placeholder="Amount"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">{orderAsset}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={orderSide !== 'SELL'}
                    className={`w-full py-2.5 rounded font-bold tracking-wider text-sm transition-all duration-200 mt-auto ${
                      orderSide === 'SELL'
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50'
                    }`}
                  >
                    Sell {orderAsset}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Order Book & Portfolio */}
        <div className="col-span-3 bg-zinc-950 flex flex-col h-full overflow-hidden">
          {/* Order Book Section */}
          <div className="flex-1 min-h-[50%] flex flex-col border-b border-zinc-800">
             <OrderBookComponent symbol={`${orderAsset}USDT`} />
          </div>

          {/* Portfolio Section */}
          <div className="h-64 flex flex-col shrink-0 bg-zinc-950">
            <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 shrink-0">
              <h2 className="text-sm font-bold text-zinc-100">Assets</h2>
              <span className="text-xs text-zinc-500 hover:text-blue-400 cursor-pointer transition-colors">Deposit</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {portfolio.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                  No assets found.
                </div>
              ) : (
                <div className="space-y-1">
                  {portfolio.map((item) => {
                    if (item.balance <= 0) return null;
                    const currentPrice = item.asset === 'USDT' ? 1 : (prices[`${item.asset}USDT`] || 0);
                    const value = item.balance * currentPrice;

                    return (
                      <div key={item.asset} className="flex justify-between items-center p-2 hover:bg-zinc-900 rounded group transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">{item.asset}</span>
                        </div>
                        <div className="text-right flex flex-col">
                          <span className="font-mono text-xs text-zinc-300">
                            {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            ≈ ${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-800 py-1.5 px-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 font-mono">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Operational</span>
          <span>Latency: 12ms</span>
        </div>
        <div className="text-[10px] text-zinc-600">
          N_Exchange Simulation Environment
        </div>
      </footer>
    </div>
  );
};
