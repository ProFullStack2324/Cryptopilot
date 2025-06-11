
// src/lib/types.ts
import type { ChartConfig } from "@/components/ui/chart";
import type { Dispatch, SetStateAction } from 'react';

export const PRICE_HISTORY_POINTS_TO_KEEP = 200;

export interface Trade {
  id: string;
  orderId?: string;
  timestamp: number;
  datetime: string;
  symbol: string; // Símbolo CCXT: BTC/USDT
  type: string; // market, limit
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
    rate?: number;
  };
  status?: 'Completado' | 'Pendiente' | 'Fallido' | 'Cancelado' | string; // O cualquier otro estado de Binance/CCXT
  pnl?: number;
}

export interface MarketPriceDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  sma10?: number;
  sma20?: number;
  sma50?: number;
  aiBuySignal?: number;
  aiSellSignal?: number;
  smaCrossBuySignal?: number;
  smaCrossSellSignal?: number;
  macdLine?: number;
  signalLine?: number;
  macdHistogram?: number;
}

export const marketPriceChartConfigDark = {
  price: { label: "Precio", color: "hsl(var(--chart-1))" },
  sma10: { label: "SMA 10", color: "hsl(var(--chart-5))" },
  sma20: { label: "SMA 20", color: "hsl(var(--chart-2))" },
  sma50: { label: "SMA 50 (Ref. Bot)", color: "hsl(var(--chart-4))" },
  aiBuySignal: { label: "Señal AI (Compra)", color: "hsl(var(--chart-3))" },
  aiSellSignal: { label: "Señal AI (Venta)", color: "hsl(var(--destructive))" },
  smaCrossBuySignal: { label: "Cruce SMA (Compra)", color: "hsl(var(--chart-3) / 0.7)" },
  smaCrossSellSignal: { label: "Cruce SMA (Venta)", color: "hsl(var(--destructive) / 0.7)" },
  macdLine: { label: "MACD Line", color: "hsl(var(--chart-6))" },
  signalLine: { label: "MACD Signal", color: "hsl(var(--chart-7))" },
  macdHistogram: { label: "MACD Histograma" },
} satisfies ChartConfig;

export interface Market {
  id: string; // Binance ID: BTCUSDT
  symbol: string; // CCXT Symbol: BTC/USDT
  name: string;
  baseAsset: string;
  quoteAsset: string;
  latestPrice: number | null;
  change24h?: number | null;
  minNotional?: number;
  minQty?: number;
  amountPrecision?: number;
  pricePrecision?: number;
  quotePrecision?: number;
  basePrecision?: number; // A menudo igual a amountPrecision
}

export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  summary: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: number;
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

export interface PerformanceDataPoint {
  date: string;
  value: number;
}
export const mockPerformanceChartConfigDark = {
  value: { label: "Valor Portafolio", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

export interface SignalEvent {
  timestamp: number;
  price: number;
  type: 'BUY' | 'SELL';
  confidence: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
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
], null, 2);

export interface Balance {
  available: number;
  onOrder: number;
  total: number;
}

export interface UseTradingBotProps {
  selectedMarket: Market | null;
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null;
  allBinanceBalances: Record<string, Balance> | null;
  botIntervalMs?: number;
  isBotRunning: boolean;
  setIsBotRunning: Dispatch<SetStateAction<boolean>>;
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void;
  // useTestnet?: boolean; // ELIMINADO
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
  // useTestnet?: boolean; // ELIMINADO
  // setUseTestnet?: Dispatch<SetStateAction<boolean>>; // ELIMINADO
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
  market: Market;
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
  balances: Record<string, Balance> | null;
  isLoading: boolean;
  error: string | null;
  // useTestnet?: boolean; // ELIMINADO
}

export interface BotControlsProps {
    isBotRunning: boolean;
    onToggleBot: () => void;
    // onGenerateSignals: () => void; // Eliminado si el bot es automático
    isLoadingAiSignals: boolean; // Si las señales AI son una feature separada
    aiSignalError: string | null;
    selectedMarketSymbol?: string;
    marketRulesError: string | null;
    areMarketRulesLoaded: boolean;
}

// Props para los hooks de datos de Binance, eliminando useTestnet
export interface UseBinanceMarketDataProps {
  symbol?: string;
  timeframe?: string;
  limit?: number;
  initialFetch?: boolean;
  // useTestnet?: boolean; // ELIMINADO
}

export interface UseBinanceBalancesProps {
  initialFetch?: boolean;
  fetchIntervalMs?: number;
  // useTestnet?: boolean; // ELIMINADO
}

export interface UseBinanceTradeHistoryProps {
  initialFetch?: boolean;
  symbol?: string;
  since?: number;
  limit?: number;
  // useTestnet?: boolean; // ELIMINADO
}
