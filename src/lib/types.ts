// src/lib/types.ts
import type { ChartConfig } from "@/components/ui/chart"; // Importa ChartConfig desde tu componente UI

export const PRICE_HISTORY_POINTS_TO_KEEP = 200;

export interface Trade {
  id: string;
  date: string;
  type: 'Compra' | 'Venta';
  asset: string;
  amount: number;
  price: number;
  total: number;
  status: 'Completado' | 'Pendiente' | 'Fallido';
  pnl?: number;
}

export interface MarketPriceDataPoint {
  timestamp: number; // Unix timestamp en segundos
  price: number;
  volume: number;
  sma10?: number;
  sma20?: number;
  sma50?: number;

  // Señales de IA
  aiBuySignal?: number; // Precio en el momento de la señal de compra de IA
  aiSellSignal?: number; // Precio en el momento de la señal de venta de IA
  // Señales de Cruce de SMA
  smaCrossBuySignal?: number; // Precio en el momento de la señal de compra por cruce de SMA
  smaCrossSellSignal?: number; // Precio en el momento de la señal de venta por cruce de SMA
  // NUEVAS PROPIEDADES MACD
  macdLine?: number;        // Línea MACD
  signalLine?: number;      // Línea de Señal MACD
  macdHistogram?: number;   // Histograma MACD
}

// **IMPORTANTE:** Aquí NO se declara ChartConfig de nuevo. Se importa desde "@/components/ui/chart".
// Si el archivo 'chart.tsx' NO exporta ChartConfig, entonces tendrías que definirla aquí,
// pero tu importación sugiere que ya existe en otro lugar.

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
    label: "Señal AI (Compra)",
    color: "hsl(var(--chart-3))", // Color para compra (verde)
  },
  aiSellSignal: {
    label: "Señal AI (Venta)",
    color: "hsl(var(--destructive))", // Color para venta (rojo)
  },
  smaCrossBuySignal: {
    label: "Cruce SMA (Compra)",
    color: "hsl(var(--chart-3) / 0.7)", // Un verde un poco más tenue
  },
  smaCrossSellSignal: {
    label: "Cruce SMA (Venta)",
    color: "hsl(var(--destructive) / 0.7)", // Un rojo un poco más tenue
  },
  // NUEVAS CONFIGURACIONES MACD
  macdLine: {
    label: "MACD Line",
    color: "hsl(var(--chart-6))", // Un nuevo color, ej. azul oscuro
  },
  signalLine: {
    label: "MACD Signal",
    color: "hsl(var(--chart-7))", // Otro nuevo color, ej. naranja
  },
  macdHistogram: {
    label: "MACD Histograma", // Este se mostrará en el tooltip, pero la barra tendrá colores condicionales
  },
} satisfies ChartConfig;


// src/lib/types.ts

// ... (todo tu código anterior, como Trade, MarketPriceDataPoint, etc.) ...

export interface Market {
  id: string; // Ej. "BTCUSDT"
  symbol: string; // El símbolo del par de trading, ej. "BTCUSDT" (igual que id, pero útil para claridad)
  baseAsset: string; // El activo base, ej. "BTC"
  quoteAsset: string; // El activo de cotización, ej. "USDT"
  name: string; // Nombre amigable, ej. "BTC/USD"
  icon?: React.ComponentType<{ className?: string }>;
  latestPrice?: number | null; // <-- Ya corregimos esto a 'number | null'
  change24h?: number;

  // --- ¡ASEGÚRATE DE QUE ESTAS PROPIEDADES ESTÉN AQUÍ! ---
  // Estas propiedades vienen de la respuesta de exchangeInfo de Binance
  pricePrecision?: number; // Número de decimales para el precio
  amountPrecision?: number; // Número de decimales para la cantidad del activo base
  quotePrecision?: number; // Número de decimales para el activo de cotización
  basePrecision?: number; // Número de decimales para el activo base
  minQty?: number; // Cantidad mínima para una orden
  maxQty?: number; // Cantidad máxima para una orden
  minNotional?: number; // Valor nocional mínimo para una orden
  // --- FIN DE LAS PROPIEDADES DE PRECISIÓN ---
}

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

// Ajuste CORRECTO para BalanceCardProps
export interface BalanceCardProps {
  // Las propiedades 'label', 'value', 'unit', 'change', 'changePercentage', 'isPositive'
  // que habíamos puesto antes, parece que no son las que usas en BalanceCard.
  // En su lugar, estás usando estas:
  balance: number | null; // El valor del balance, puede ser null si está cargando o hay error
  asset: string; // La divisa o el activo, ej. "USD", "BTC"
  isLoading: boolean; // Para saber si los datos están cargando
  description: string; // Una descripción para la tarjeta
  title: string; // El título de la tarjeta
  // Puedes añadir más propiedades aquí si tu BalanceCard las necesita, por ejemplo:
  // icon?: React.ComponentType<{ className?: string }>;
}
