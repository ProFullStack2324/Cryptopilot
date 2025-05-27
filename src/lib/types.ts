
import type { ChartConfig } from "@/components/ui/chart";

export interface Trade {
  id: string;
  date: string;
  type: 'Buy' | 'Sell';
  asset: string; // e.g., BTC/USD
  amount: number;
  price: number;
  total: number;
  status: 'Filled' | 'Pending' | 'Failed';
}

// Deprecado o a ser reemplazado por datos de mercado específicos
export interface PerformanceDataPoint {
  date: string; // o timestamp
  value: number;
}

// Datos de precios para un mercado específico
export interface MarketPriceDataPoint {
  timestamp: number; // Unix timestamp
  price: number;
}

export interface Market {
  id: string; // e.g., "BTCUSDT"
  baseAsset: string; // e.g., "BTC"
  quoteAsset: string; // e.g., "USD"
  name: string; // e.g., "BTC/USD"
  icon?: React.ComponentType<{ className?: string }>; // Opcional: Icono para el activo base
  latestPrice?: number; // Para mostrar en el selector
  change24h?: number; // Para mostrar en el selector
}

export const mockMarkets: Market[] = [
  { id: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USD", name: "BTC/USD", latestPrice: 61500.75, change24h: 1.5 },
  { id: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USD", name: "ETH/USD", latestPrice: 3400.20, change24h: -0.5 },
  { id: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USD", name: "SOL/USD", latestPrice: 150.10, change24h: 3.2 },
  { id: "ADAUSDT", baseAsset: "ADA", quoteAsset: "USD", name: "ADA/USD", latestPrice: 0.42, change24h: -1.1 },
  // Podríamos añadir pares de divisas simulados si quisiéramos
  // { id: "EURUSD", baseAsset: "EUR", quoteAsset: "USD", name: "EUR/USD" },
];

// Datos de precios simulados por mercado
export const mockMarketPriceHistory: Record<string, MarketPriceDataPoint[]> = {
  "BTCUSDT": Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 24 * 60 * 60 * 1000, // últimos 30 días
    price: 60000 + Math.random() * 5000 - 2500 + i * 50,
  })),
  "ETHUSDT": Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 24 * 60 * 60 * 1000,
    price: 3300 + Math.random() * 400 - 200 + i * 10,
  })),
  "SOLUSDT": Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 24 * 60 * 60 * 1000,
    price: 140 + Math.random() * 20 - 10 + i * 1,
  })),
  "ADAUSDT": Array.from({ length: 30 }, (_, i) => ({
    timestamp: Date.now() - (30 - i) * 24 * 60 * 60 * 1000,
    price: 0.40 + Math.random() * 0.1 - 0.05 + i * 0.005,
  })),
};


export const marketPriceChartConfigDark = {
  price: {
    label: "Precio",
    color: "hsl(var(--chart-1))", 
  },
} satisfies ChartConfig;


export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  signals: string; // This will be a JSON string of SignalItem[]
  explanation: string;
}

export type ParsedSignals = SignalItem[];

export interface OrderFormData {
  type: 'buy' | 'sell';
  marketId: string;
  amount: number; // Cantidad del activo base
  price?: number; // Precio por unidad del activo base (para órdenes límite)
  orderType: 'market' | 'limit';
}
