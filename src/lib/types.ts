
import type { ChartConfig } from "@/components/ui/chart";

export interface Trade {
  id: string;
  date: string;
  type: 'Compra' | 'Venta';
  asset: string;
  amount: number;
  price: number;
  total: number;
  status: 'Completado' | 'Pendiente' | 'Fallido';
  pnl?: number; // Ganancia/Pérdida realizada para esta operación
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
    const timestamp = nowInSeconds - (points - 1 - i) * minutesInterval * 60; // Timestamps yendo hacia atrás desde ahora
    history.push({
      timestamp: timestamp,
      price: parseFloat(currentPrice.toFixed(5)),
    });
    // Simular movimiento de precio
    currentPrice *= (1 + (Math.random() - 0.5) * volatility); 
    if (currentPrice <= 0) currentPrice = basePrice * 0.1; // Evitar precios negativos o cero
  }
  return history;
};


export const mockMarketPriceHistory: Record<string, MarketPriceDataPoint[]> = {
  "BTCUSDT": generateInitialPriceHistory(61500, 0.0005, 200, 1), // 200 puntos, 1 min de intervalo
  "ETHUSDT": generateInitialPriceHistory(3400, 0.0007, 200, 1),
  "SOLUSDT": generateInitialPriceHistory(150, 0.001, 200, 1),
  "ADAUSDT": generateInitialPriceHistory(0.42, 0.0015, 200, 1),
  "XRPUSDT": generateInitialPriceHistory(0.52, 0.0012, 200, 1),
  "DOGEUSDT": generateInitialPriceHistory(0.15, 0.002, 200, 1),
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
  aiBuySignal: { // Renombrado para claridad
    label: "Compra IA",
    color: "hsl(var(--chart-3))", // Verde más brillante
  },
  aiSellSignal: { // Renombrado para claridad
    label: "Venta IA",
    color: "hsl(var(--destructive))", // Rojo destructivo
  },
  smaCrossBuySignal: {
    label: "Cruce SMA Compra",
    color: "hsl(var(--chart-3) / 0.7)", // Verde más claro/transparente
  },
  smaCrossSellSignal: {
    label: "Cruce SMA Venta",
    color: "hsl(var(--destructive) / 0.7)", // Rojo más claro/transparente
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
  price?: number; // Opcional para órdenes de mercado
  orderType: 'market' | 'limit';
}

export const initialMockTrades: Trade[] = [
  { id: '1', date: '15/07/2024, 10:30', type: 'Compra', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Completado' },
  { id: '2', date: '14/07/2024, 15:45', type: 'Venta', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Completado' },
];

export interface PerformanceDataPoint {
  date: string; // Formato HH:mm:ss
  value: number;
}
export const mockPerformanceChartConfigDark = {
  value: {
    label: "Valor Portafolio",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export interface SignalEvent { // Usado para señales de IA
  timestamp: number;
  price: number;
  type: 'BUY' | 'SELL';
  confidence: number;
}

export interface SmaCrossoverEvent { // Nuevo tipo para cruces de SMA
    timestamp: number;
    price: number;
    type: 'SMA_CROSS_BUY' | 'SMA_CROSS_SELL';
}

export interface SimulatedPosition {
  marketId: string;
  entryPrice: number;
  amount: number;
  type: 'buy' | 'sell'; 
  timestamp: number; // Unix timestamp del momento de entrada
}
