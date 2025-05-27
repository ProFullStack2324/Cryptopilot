
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
}

export interface MarketPriceDataPoint {
  timestamp: number; // Unix timestamp en segundos
  price: number;
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

// Generar historial con timestamps en segundos y más puntos para la simulación inicial
const generateInitialPriceHistory = (basePrice: number, volatility: number, points: number, minutesInterval: number): MarketPriceDataPoint[] => {
  const history: MarketPriceDataPoint[] = [];
  let currentPrice = basePrice;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  for (let i = 0; i < points; i++) {
    const timestamp = nowInSeconds - (points - 1 - i) * minutesInterval * 60;
    history.push({
      timestamp: timestamp,
      price: currentPrice,
    });
    currentPrice *= (1 + (Math.random() - 0.5) * volatility); // Mover el precio
  }
  return history;
};


export const mockMarketPriceHistory: Record<string, MarketPriceDataPoint[]> = {
  "BTCUSDT": generateInitialPriceHistory(61500, 0.01, 200, 15), // 200 puntos, cada 15 minutos
  "ETHUSDT": generateInitialPriceHistory(3400, 0.015, 200, 15),
  "SOLUSDT": generateInitialPriceHistory(150, 0.02, 200, 15),
  "ADAUSDT": generateInitialPriceHistory(0.42, 0.025, 200, 15),
  "XRPUSDT": generateInitialPriceHistory(0.52, 0.022, 200, 15),
  "DOGEUSDT": generateInitialPriceHistory(0.15, 0.03, 200, 15),
};


export const marketPriceChartConfigDark = {
  price: {
    label: "Precio",
    color: "hsl(var(--chart-1))", 
  },
  buySignal: {
    label: "Compra IA",
    color: "hsl(var(--chart-3))",
  },
  sellSignal: {
    label: "Venta IA",
    color: "hsl(var(--chart-4))",
  }
} satisfies ChartConfig;


export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  signals: string; 
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

// Nuevo tipo para eventos de señal en el gráfico
export interface SignalEvent {
  timestamp: number; // Unix timestamp en segundos, coincidiendo con MarketPriceDataPoint
  price: number;
  type: 'BUY' | 'SELL';
  confidence: number;
}
