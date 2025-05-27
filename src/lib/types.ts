
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

// Configuración para el gráfico de rendimiento general (PerformanceChart)
export const mockPerformanceChartConfigDark = {
  value: { // 'value' es la clave en PerformanceDataPoint
    label: "Valor Portafolio",
    color: "hsl(var(--chart-2))", // Usar otro color para distinguirlo
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

export const initialMockTrades: Trade[] = [
  { id: '1', date: '2024-07-15 10:30', type: 'Buy', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Filled' },
  { id: '2', date: '2024-07-14 15:45', type: 'Sell', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Filled' },
  { id: '3', date: '2024-07-13 09:12', type: 'Buy', asset: 'SOL/USD', amount: 2, price: 150, total: 300, status: 'Pending' },
  { id: '4', date: '2024-07-12 18:05', type: 'Buy', asset: 'BTC/USD', amount: 0.002, price: 61500, total: 123, status: 'Filled' },
  { id: '5', date: '2024-07-11 11:50', type: 'Sell', asset: 'ADA/USD', amount: 100, price: 0.40, total: 40, status: 'Failed' },
  { id: '6', date: '2024-07-10 22:15', type: 'Buy', asset: 'ETH/USD', amount: 0.05, price: 3350, total: 167.50, status: 'Filled' },
];
