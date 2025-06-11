
// src/lib/types.ts
import type { ChartConfig } from "@/components/ui/chart"; // Importa ChartConfig desde tu componente UI
import type { Dispatch, SetStateAction } from 'react'; // Asegúrate de importar Dispatch y SetStateAction

export const PRICE_HISTORY_POINTS_TO_KEEP = 200;

export interface Trade {
  id: string; // Identificador único del trade
  orderId?: string; // ID de la orden en Binance (opcional, puede que no siempre lo tengas o lo necesites en el frontend para todos los trades)
  timestamp: number; // Unix timestamp en milisegundos
  datetime: string; // Fecha y hora legible (ej: '2023-10-21T10:30:00.000Z')
  symbol: string; // Símbolo del par (ej: 'BTC/USDT')
  type: 'market' | 'limit' | string; // Tipo de orden (market, limit, u otros que Binance soporte)
  side: 'buy' | 'sell'; // Lado de la orden
  price: number; // Precio de ejecución
  amount: number; // Cantidad del activo base
  cost: number; // Costo total del trade (price * amount)
  fee?: { // Información de la comisión (opcional)
    cost: number; // Costo de la comisión
    currency: string; // Moneda de la comisión
    rate?: number; // Tasa de la comisión (opcional)
  };
  status?: 'Completado' | 'Pendiente' | 'Fallido' | 'Cancelado' | string; // Estado del trade/orden
  pnl?: number; // Ganancia o pérdida (opcional, más relevante para posiciones cerradas)
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
  macdLine: {
    label: "MACD Line",
    color: "hsl(var(--chart-6))", 
  },
  signalLine: {
    label: "MACD Signal",
    color: "hsl(var(--chart-7))", 
  },
  macdHistogram: {
    label: "MACD Histograma", 
  },
} satisfies ChartConfig;

export interface Market {
  id: string; // El símbolo completo del exchange (ej. BTCUSDT) - USADO PARA API DE BINANCE
  symbol: string; // El símbolo estandarizado (ej. BTC/USDT) - USADO PARA CCXT Y DISPLAY
  name: string; // Nombre amigable (ej. BTC/USDT)
  baseAsset: string; // Moneda base (ej. BTC)
  quoteAsset: string; // Moneda cotizada (ej. USDT)
  latestPrice: number | null;
  change24h?: number | null; // Puede ser opcional si no siempre está disponible
  minNotional?: number;
  minQty?: number;
  amountPrecision?: number; // Precisión para la cantidad del activo base
  pricePrecision?: number;  // Precisión para el precio
  quotePrecision?: number;  // Precisión para la moneda cotizada (a menudo igual a pricePrecision)
}

export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  summary: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0 a 1
  reasoning: string;
  timestamp: number;
  signals: string; // JSON string de SignalItem[]
  explanation: string;
}

export type ParsedSignals = SignalItem[];

export interface OrderFormData {
  type: 'buy' | 'sell';
  marketId: string; // Símbolo de Binance, ej: BTCUSDT
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
  type: 'BUY' | 'SELL'; // Para el bot, la acción es comprar o vender
  confidence: number;
  signal: 'BUY' | 'SELL' | 'HOLD'; // La señal original de la IA
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

export const exampleHistoricalDataForAI = JSON.stringify([
  {"timestamp": "2023-10-01T00:00:00Z", "open": 27000, "high": 27200, "low": 26800, "close": 27100, "volume": 1000},
  {"timestamp": "2023-10-02T00:00:00Z", "open": 27100, "high": 27500, "low": 27000, "close": 27400, "volume": 1200},
  // ... más datos
], null, 2);

export interface Balance {
  available: number;
  onOrder: number;
  total: number;
}

export interface UseTradingBotProps {
  selectedMarket: Market | null; // Permitir que sea null si no hay mercado seleccionado
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null;
  allBinanceBalances: Record<string, Balance> | null; // Permitir que sea null si no se han cargado
  // onPlaceOrder se maneja internamente en el bot ahora
  botIntervalMs: number;
  isBotRunning: boolean;
  setIsBotRunning: Dispatch<SetStateAction<boolean>>;
  useTestnet?: boolean; 
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void;
}

export interface AppHeaderProps {
  toggleLeftSidebar: () => void;
  isLeftSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  isRightSidebarOpen: boolean;
  portfolioBalance: number | null;
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  isBinanceBalancesLoading: boolean;
  binanceBalancesError: string | null;
  // useTestnet y setUseTestnet eliminadas porque AppHeader ya no gestiona este estado directamente
}

export interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  priceHistory: MarketPriceDataPoint[];
  smaCrossoverEvents: SmaCrossoverEvent[];
  aiSignalEvents: SignalEvent[];
  isBotActive: boolean;
}

export interface TradeFormProps {
  market: Market; // El objeto Market completo
  currentPrice: number | null;
  availableQuoteBalance: number;
  availableBaseBalance: number;
  onPlaceOrder: (orderData: OrderFormData) => Promise<boolean>;
  isLoadingTrade: boolean;
}

export interface BalanceCardProps {
  title: string;
  description: string;
  balance: number | null;
  asset: string;
  isLoading: boolean;
  error: string | null;
}

export interface BinanceBalancesDisplayProps {
  balances: Record<string, Balance>;
  isLoading: boolean;
  error: string | null;
  useTestnet?: boolean; 
}

export interface BotControlsProps {
    isBotRunning: boolean;
    onToggleBot: () => void;
    isLoadingAiSignals: boolean;
    onGenerateSignals: () => void; 
    aiSignalError: string | null;
    useTestnet: boolean; 
    selectedMarketSymbol?: string; 
    marketRulesError: string | null; 
    areMarketRulesLoaded: boolean; 
}
