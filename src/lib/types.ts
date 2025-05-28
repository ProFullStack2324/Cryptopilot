
import type { ChartConfig } from "@/components/ui/chart";

export const PRICE_HISTORY_POINTS_TO_KEEP = 200;

export interface Trade {
  id: string;
  date: string;
  type: 'Compra' | 'Venta'; // Ya en español
  asset: string;
  amount: number;
  price: number;
  total: number;
  status: 'Completado' | 'Pendiente' | 'Fallido'; // Ya en español
  pnl?: number; 
}

export interface MarketPriceDataPoint {
  timestamp: number; // Unix timestamp en segundos
  price: number;
  sma10?: number; 
  sma20?: number; 
  sma50?: number; 
}

export interface Market {
  id: string;
  baseAsset: string;
  quoteAsset: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  latestPrice?: number;
  change24h?: number;
}

export const mockMarkets: Market[] = [
  { id: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USD", name: "BTC/USD", latestPrice: 61500.75, change24h: 1.5 },
  { id: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USD", name: "ETH/USD", latestPrice: 3400.20, change24h: -0.5 },
  { id: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USD", name: "SOL/USD", latestPrice: 150.10, change24h: 3.2 },
  { id: "ADAUSDT", baseAsset: "ADA", quoteAsset: "USD", name: "ADA/USD", latestPrice: 0.42, change24h: -1.1 },
  { id: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USD", name: "XRP/USD", latestPrice: 0.52, change24h: 0.8 },
  { id: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USD", name: "DOGE/USD", latestPrice: 0.15, change24h: 2.5 },
];

const generateInitialPriceHistory = (basePrice: number, volatility: number, points: number, minutesInterval: number): MarketPriceDataPoint[] => {
  const history: MarketPriceDataPoint[] = [];
  let currentPrice = basePrice;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  for (let i = 0; i < points; i++) {
    const timestamp = nowInSeconds - (points - 1 - i) * minutesInterval * 60; 
    history.push({
      timestamp: timestamp,
      price: parseFloat(currentPrice.toFixed(5)),
    });
    currentPrice *= (1 + (Math.random() - 0.5) * volatility); 
    if (currentPrice <= 0) currentPrice = basePrice * 0.1; 
  }
  return history;
};


export const mockMarketPriceHistory: Record<string, MarketPriceDataPoint[]> = {
  "BTCUSDT": generateInitialPriceHistory(61500, 0.0005, PRICE_HISTORY_POINTS_TO_KEEP, 1), 
  "ETHUSDT": generateInitialPriceHistory(3400, 0.0007, PRICE_HISTORY_POINTS_TO_KEEP, 1),
  "SOLUSDT": generateInitialPriceHistory(150, 0.001, PRICE_HISTORY_POINTS_TO_KEEP, 1),
  "ADAUSDT": generateInitialPriceHistory(0.42, 0.0015, PRICE_HISTORY_POINTS_TO_KEEP, 1),
  "XRPUSDT": generateInitialPriceHistory(0.52, 0.0012, PRICE_HISTORY_POINTS_TO_KEEP, 1),
  "DOGEUSDT": generateInitialPriceHistory(0.15, 0.002, PRICE_HISTORY_POINTS_TO_KEEP, 1),
};


export const marketPriceChartConfigDark = {
  price: {
    label: "Precio",
    color: "hsl(var(--chart-1))",
  },
  sma10: {
    label: "SMA 10",
    color: "hsl(var(--chart-5))", 
  },
  sma20: {
    label: "SMA 20",
    color: "hsl(var(--chart-2))", 
  },
  sma50: {
    label: "SMA 50 (Ref. Bot)",
    color: "hsl(var(--chart-4))", 
  },
  aiBuySignal: { 
    label: "Compra IA",
    color: "hsl(var(--chart-3))", 
  },
  aiSellSignal: { 
    label: "Venta IA",
    color: "hsl(var(--destructive))", 
  },
  smaCrossBuySignal: {
    label: "Cruce SMA Compra",
    color: "hsl(var(--chart-3) / 0.7)", 
  },
  smaCrossSellSignal: {
    label: "Cruce SMA Venta",
    color: "hsl(var(--destructive) / 0.7)", 
  }
} satisfies ChartConfig;


export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  signals: string; // JSON string de SignalItem[]
  explanation: string;
}

export type ParsedSignals = SignalItem[];

export interface OrderFormData {
  type: 'buy' | 'sell';
  marketId: string;
  amount: number;
  price?: number; 
  orderType: 'market' | 'limit';
}

export const initialMockTrades: Trade[] = [
  { id: '1', date: '15/07/2024, 10:30', type: 'Compra', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Completado' },
  { id: '2', date: '14/07/2024, 15:45', type: 'Venta', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Completado' },
];

export interface PerformanceDataPoint {
  date: string; 
  value: number;
}
export const mockPerformanceChartConfigDark = {
  value: {
    label: "Valor Portafolio",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export interface SignalEvent { 
  timestamp: number;
  price: number;
  type: 'BUY' | 'SELL';
  confidence: number;
}

export interface SmaCrossoverEvent { 
    timestamp: number;
    price: number;
    type: 'SMA_CROSS_BUY' | 'SMA_CROSS_SELL';
}

export interface SimulatedPosition {
  marketId: string;
  entryPrice: number;
  amount: number;
  type: 'buy' | 'sell'; 
  timestamp: number; 
}

// Example historical data to be used by the AI when auto-generating signals
export const exampleHistoricalDataForAI = JSON.stringify([
  {"timestamp": "2023-10-01T00:00:00Z", "open": 27000, "high": 27200, "low": 26800, "close": 27100, "volume": 1000},
  {"timestamp": "2023-10-02T00:00:00Z", "open": 27100, "high": 27500, "low": 27000, "close": 27400, "volume": 1200},
  {"timestamp": "2023-10-03T00:00:00Z", "open": 27400, "high": 28000, "low": 27300, "close": 27900, "volume": 1500},
  {"timestamp": "2023-10-04T00:00:00Z", "open": 27900, "high": 28100, "low": 27700, "close": 27800, "volume": 1100},
  {"timestamp": "2023-10-05T00:00:00Z", "open": 27800, "high": 28200, "low": 27500, "close": 28150, "volume": 1300}
], null, 2);
