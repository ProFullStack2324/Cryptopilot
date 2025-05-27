
import type { ChartConfig } from "@/components/ui/chart";

export interface Trade {
  id: string;
  date: string;
  type: 'Compra' | 'Venta'; // Traducido
  asset: string; // e.g., BTC/USD
  amount: number;
  price: number;
  total: number;
  status: 'Completado' | 'Pendiente' | 'Fallido'; // Traducido
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
  { id: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USD", name: "XRP/USD", latestPrice: 0.52, change24h: 0.8 },
  { id: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USD", name: "DOGE/USD", latestPrice: 0.15, change24h: 2.5 },
];

// Datos de precios simulados por mercado
export const mockMarketPriceHistory: Record<string, MarketPriceDataPoint[]> = {
  "BTCUSDT": Array.from({ length: 60 }, (_, i) => ({ // Más puntos de datos
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000, // últimos 30 días, cada 12 horas
    price: 60000 + Math.sin(i / 5) * 1500 + Math.random() * 1000 - 500 + i * 20,
  })),
  "ETHUSDT": Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000,
    price: 3300 + Math.sin(i / 6) * 200 + Math.random() * 80 - 40 + i * 5,
  })),
  "SOLUSDT": Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000,
    price: 140 + Math.sin(i / 4) * 15 + Math.random() * 10 - 5 + i * 0.5,
  })),
  "ADAUSDT": Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000,
    price: 0.40 + Math.sin(i / 7) * 0.05 + Math.random() * 0.02 - 0.01 + i * 0.001,
  })),
   "XRPUSDT": Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000,
    price: 0.50 + Math.sin(i / 5) * 0.03 + Math.random() * 0.01 - 0.005 + i * 0.0005,
  })),
  "DOGEUSDT": Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now() - (60 - i) * 12 * 60 * 60 * 1000,
    price: 0.14 + Math.sin(i / 4) * 0.02 + Math.random() * 0.005 - 0.0025 + i * 0.0002,
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

// Estado inicial para las operaciones, con tipos traducidos
export const initialMockTrades: Trade[] = [
  { id: '1', date: '2024-07-15 10:30', type: 'Compra', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Completado' },
  { id: '2', date: '2024-07-14 15:45', type: 'Venta', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Completado' },
  { id: '3', date: '2024-07-13 09:12', type: 'Compra', asset: 'SOL/USD', amount: 2, price: 150, total: 300, status: 'Pendiente' },
  { id: '4', date: '2024-07-12 18:05', type: 'Compra', asset: 'BTC/USD', amount: 0.002, price: 61500, total: 123, status: 'Completado' },
  { id: '5', date: '2024-07-11 11:50', type: 'Venta', asset: 'ADA/USD', amount: 100, price: 0.40, total: 40, status: 'Fallido' },
  { id: '6', date: '2024-07-10 22:15', type: 'Compra', asset: 'ETH/USD', amount: 0.05, price: 3350, total: 167.50, status: 'Completado' },
];

// Deprecado o a ser reemplazado por datos de mercado específicos
export interface PerformanceDataPoint {
  date: string; // o timestamp
  value: number;
}
// Configuración para el gráfico de rendimiento general (PerformanceChart) - Mantenido por si se reintroduce
export const mockPerformanceChartConfigDark = {
  value: { // 'value' es la clave en PerformanceDataPoint
    label: "Valor Portafolio",
    color: "hsl(var(--chart-2))", // Usar otro color para distinguirlo
  },
} satisfies ChartConfig;
