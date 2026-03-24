import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useMarketHook } from '../context/MarketContext';

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
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-800">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">CryptoSim Terminal</h2>
          <div className="mb-4">
            <label className="block text-zinc-400 text-sm mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="Enter to start simulating..."
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
            Start Trading
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-lg">
          <h1 className="text-2xl font-bold text-blue-400 tracking-wider">CryptoSim Terminal</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-sm text-zinc-400">Live Binance Data</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300 transition-colors">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Market Data */}
          <div className="lg:col-span-1 bg-zinc-900 rounded-xl border border-zinc-800 p-4 shadow-lg overflow-y-auto max-h-[calc(100vh-160px)]">
            <h2 className="text-xl font-bold mb-4 text-zinc-100 border-b border-zinc-800 pb-2">Market Data</h2>
            <div className="space-y-2">
              {availableAssets.map((asset) => {
                const symbol = `${asset}USDT`;
                const price = prices[symbol];
                return (
                  <div key={asset} className="flex justify-between items-center p-3 hover:bg-zinc-800/50 rounded transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-zinc-300">{asset}</span>
                      <span className="text-xs text-zinc-500">USDT</span>
                    </div>
                    <span className={`font-mono ${price ? 'text-green-400' : 'text-zinc-500'}`}>
                      {price ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}` : 'Loading...'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trading Form */}
          <div className="lg:col-span-1 bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg">
             <h2 className="text-xl font-bold mb-6 text-zinc-100 border-b border-zinc-800 pb-2">Trade</h2>
             <form onSubmit={submitOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">Side</label>
                    <select 
                      value={orderSide} 
                      onChange={(e) => setOrderSide(e.target.value)}
                      className={`w-full bg-zinc-800 border-none rounded px-3 py-2 text-sm focus:ring-1 outline-none ${orderSide === 'BUY' ? 'text-green-400 ring-green-500/50' : 'text-red-400 ring-red-500/50'}`}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">Asset</label>
                    <select 
                      value={orderAsset} 
                      onChange={(e) => setOrderAsset(e.target.value)}
                      className="w-full bg-zinc-800 text-white border-none rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none"
                    >
                      {availableAssets.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Order Type</label>
                  <div className="flex bg-zinc-800 rounded p-1">
                    <button type="button" onClick={() => setOrderType('MARKET')} className={`flex-1 py-1 text-sm rounded transition-colors ${orderType === 'MARKET' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>Market</button>
                    <button type="button" onClick={() => setOrderType('LIMIT')} className={`flex-1 py-1 text-sm rounded transition-colors ${orderType === 'LIMIT' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>Limit</button>
                  </div>
                </div>

                {orderType === 'LIMIT' && (
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">Limit Price (USDT)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      required
                      className="w-full bg-zinc-800 text-white border-none rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none placeholder-zinc-600"
                      placeholder={`Current: $${prices[`${orderAsset}USDT`] || 0}`}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-zinc-400 text-xs mb-1">Quantity ({orderAsset})</label>
                  <input 
                    type="number" 
                    step="any"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    required
                    className="w-full bg-zinc-800 text-white border-none rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none placeholder-zinc-600"
                    placeholder="0.00"
                  />
                </div>
                
                {orderQuantity && (
                  <div className="text-right text-sm text-zinc-400">
                    Est. Total: ~<span className="text-zinc-200">${((parseFloat(orderQuantity) || 0) * (orderType === 'MARKET' ? (prices[`${orderAsset}USDT`] || 0) : parseFloat(orderPrice || '0'))).toFixed(2)}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  className={`w-full py-3 rounded font-bold uppercase tracking-wider text-sm transition-colors ${
                    orderSide === 'BUY' 
                      ? 'bg-green-600 hover:bg-green-500 text-green-50' 
                      : 'bg-red-600 hover:bg-red-500 text-red-50'
                  }`}
                >
                  {orderSide} {orderAsset}
                </button>
             </form>
          </div>

          {/* Portfolio */}
          <div className="lg:col-span-1 bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-lg overflow-y-auto max-h-[calc(100vh-160px)]">
            <h2 className="text-xl font-bold mb-4 text-zinc-100 border-b border-zinc-800 pb-2">Portfolio</h2>
            
            {portfolio.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p>No assets found.</p>
                <p className="text-sm mt-1">Start trading to build your portfolio!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {portfolio.map((item) => {
                  const currentPrice = item.asset === 'USDT' ? 1 : (prices[`${item.asset}USDT`] || 0);
                  const value = item.balance * currentPrice;
                  
                  return (
                    <div key={item.asset} className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-lg text-white">{item.asset}</span>
                        <span className="font-mono text-zinc-300">
                          {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8})}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Value (USDT)</span>
                        <span className="font-mono text-green-400">
                          ${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
    </div>
  );
};
