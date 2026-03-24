import React, { useMemo } from 'react';
import { useMarketHook } from '../context/MarketContext';

interface OrderBookProps {
  symbol: string;
}

const formatNumber = (num: number, isQuantity: boolean = false) => {
  if (isQuantity) {
    if (num >= 1000000) return (num / 1000000).toFixed(3) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(3);
  }
  return num.toFixed(2);
};

const OrderBookComponent: React.FC<OrderBookProps> = ({ symbol }) => {
  const { prices, orderbooks } = useMarketHook();

  const currentPrice = prices[symbol] || 0;
  const orderbook = orderbooks[symbol] || { bids: [], asks: [] };

  const asks = useMemo(() => {
    // Show top 15 asks, sorted descending (highest price at top)
    const sorted = [...orderbook.asks].sort((a, b) => b.price - a.price).slice(-15);
    return sorted.reduce((acc, ask) => {
      const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({ ...ask, cumulative: prevCumulative + ask.quantity });
      return acc;
    }, [] as (typeof sorted[0] & { cumulative: number })[]);
  }, [orderbook.asks]);

  const bids = useMemo(() => {
    // Show top 15 bids, sorted descending (highest price at top)
    const sorted = [...orderbook.bids].sort((a, b) => b.price - a.price).slice(0, 15);
    return sorted.reduce((acc, bid) => {
      const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({ ...bid, cumulative: prevCumulative + bid.quantity });
      return acc;
    }, [] as (typeof sorted[0] & { cumulative: number })[]);
  }, [orderbook.bids]);

  const maxTotalAsks = asks.length > 0 ? asks[asks.length - 1].cumulative : 0;
  const maxTotalBids = bids.length > 0 ? bids[bids.length - 1].cumulative : 0;
  const maxTotal = Math.max(maxTotalAsks, maxTotalBids) || 1;

  const getWidth = (total: number) => {
    return Math.min(100, (total / maxTotal) * 100);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-xl border border-zinc-800 shadow-lg text-xs font-mono select-none overflow-hidden">
      <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 shrink-0">
        <h2 className="text-sm font-bold text-zinc-100">Order Book</h2>
        <span className="text-zinc-500 text-[10px]">Real-time</span>
      </div>

      <div className="flex justify-between px-3 py-2 text-zinc-500 border-b border-zinc-800/50 shrink-0">
        <div className="w-1/3 text-left">Price(USDT)</div>
        <div className="w-1/3 text-right">Amount</div>
        <div className="w-1/3 text-right">Total</div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between p-1 custom-scrollbar">
        {/* Asks (Sell Orders) - Highest price top, lowest price bottom */}
        <div className="flex flex-col flex-1 justify-end space-y-[1px]">
          {asks.map((ask, idx) => (
            <div key={`ask-${ask.price}-${idx}`} className="flex justify-between relative group hover:bg-zinc-800/50 cursor-pointer h-5 items-center px-2">
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-900/20 z-0 transition-all duration-300"
                style={{ width: `${getWidth(ask.cumulative)}%` }}
              ></div>
              <div className="w-1/3 text-left text-red-500 z-10 relative">{formatNumber(ask.price)}</div>
              <div className="w-1/3 text-right text-zinc-300 z-10 relative">{formatNumber(ask.quantity, true)}</div>
              <div className="w-1/3 text-right text-zinc-400 z-10 relative">{formatNumber(ask.cumulative, true)}</div>
            </div>
          ))}
        </div>

        {/* Current Price Display */}
        <div className="py-2 px-3 border-y border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between shrink-0 my-1">
          <div className={`text-xl font-bold ${currentPrice > (prices[`${symbol}_prev`] || 0) ? 'text-green-500' : 'text-red-500'}`}>
            {currentPrice ? formatNumber(currentPrice) : '--'}
            <span className="text-sm ml-1 text-zinc-500">${currentPrice ? formatNumber(currentPrice) : '--'}</span>
          </div>
        </div>

        {/* Bids (Buy Orders) - Highest price top, lowest price bottom */}
        <div className="flex flex-col flex-1 justify-start space-y-[1px]">
          {bids.map((bid, idx) => (
            <div key={`bid-${bid.price}-${idx}`} className="flex justify-between relative group hover:bg-zinc-800/50 cursor-pointer h-5 items-center px-2">
              <div
                className="absolute right-0 top-0 bottom-0 bg-green-900/20 z-0 transition-all duration-300"
                style={{ width: `${getWidth(bid.cumulative)}%` }}
              ></div>
              <div className="w-1/3 text-left text-green-500 z-10 relative">{formatNumber(bid.price)}</div>
              <div className="w-1/3 text-right text-zinc-300 z-10 relative">{formatNumber(bid.quantity, true)}</div>
              <div className="w-1/3 text-right text-zinc-400 z-10 relative">{formatNumber(bid.cumulative, true)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderBookComponent;
