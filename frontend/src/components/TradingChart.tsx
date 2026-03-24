import React, { useEffect, useRef, memo, useId } from 'react';

interface TradingChartProps {
  symbol: string;
}

const TradingChart: React.FC<TradingChartProps> = ({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const idStr = useId().replace(/:/g, '');
  const containerId = `tv_chart_container_${idStr}`;

  useEffect(() => {
    // Check if the script is already appended
    if (containerRef.current && containerRef.current.children.length === 0) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (typeof window.TradingView !== 'undefined' && containerRef.current) {
          new window.TradingView.widget({
            autosize: true,
            symbol: `BINANCE:${symbol}`,
            interval: "1H",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            enable_publishing: false,
            backgroundColor: "#18181b", // zinc-900 to match theme
            gridColor: "#27272a", // zinc-800
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            container_id: containerRef.current.id,
          });
        }
      };
      containerRef.current.appendChild(script);
    } else if (containerRef.current && typeof window.TradingView !== 'undefined') {
        // Clear and re-render if symbol changes
        containerRef.current.innerHTML = '';
        new window.TradingView.widget({
            autosize: true,
            symbol: `BINANCE:${symbol}`,
            interval: "1H",
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            enable_publishing: false,
            backgroundColor: "#18181b", // zinc-900 to match theme
            gridColor: "#27272a", // zinc-800
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: false,
            container_id: containerRef.current.id,
          });
    }
  }, [symbol]);

  return (
    <div
      id={containerId}
      ref={containerRef}
      className="w-full h-full"
    />
  );
};

export default memo(TradingChart);
