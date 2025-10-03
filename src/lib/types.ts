// src/lib/types.ts
// Este archivo centraliza todas las interfaces de datos de la aplicación.

import type { ChartConfig } from "@/components/ui/chart";

export const PRICE_HISTORY_POINTS_TO_KEEP = 51; // Número de puntos de historial a mantener

// INTERFAZ DE TRADE
export interface Trade {
    id: string;
    date: string;
    type: 'buy' | 'sell';
    asset: string;
    amount: number;
    price: number;
    total: number;
    status: 'Completado' | 'Pendiente' | 'Fallido';
    pnl?: number;
}

// INTERFAZ DE MARKET
export interface Market {
    id: string;
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    active: boolean;
    
    precision: {
        amount: number;
        price: number;
        base: number;
        quote: number;
    };
    limits: {
        amount: {
            min: number;
            max: number;
        };
        price: {
            min: number;
            max: number;
        };
        cost: {
            min: number; // minNotional
        };
    };
    info: any; // Información bruta del exchange, si es necesaria
    pricePrecision: number; // Por conveniencia, se añade aquí para simplificar el uso

    latestPrice: number | null; // Precio actual (se actualizará con el closePrice de la última vela)
    change24h: number | null; 
    // Las propiedades minNotional, minQty, amountPrecision, quotePrecision ya están cubiertas
    // en `limits` y `precision` o `MarketRules`, así que se eliminan duplicados aquí.
}

// INTERFAZ DE MARKET RULES (para las reglas de Binance)
export interface MarketRules {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    baseAssetPrecision: number;
    quotePrecision: number;
    icebergAllowed: boolean;
    ocoAllowed: boolean;
    quoteOrderQtyMarketAllowed: boolean;
    isSpotTradingAllowed: boolean;
    isMarginTradingAllowed: boolean;
    filters: Array<any>; // Puedes tipar esto más específicamente si lo necesitas
    lotSize: {
        minQty: number;
        maxQty: number;
        stepSize: number;
    };
    minNotional: { 
        minNotional: number; 
    };
    priceFilter: {
        minPrice: number;
        maxPrice: number;
        tickSize: number;
    };
    // ... añadir otras reglas que uses (e.g., maxNumOrders, maxNumAlgoOrders, etc.)
    // ✅ AJUSTE NECESARIO: Se añade la propiedad 'precision' para consistencia con la data real de exchange-info.
    precision: {
        price: number;
        amount: number;
        base: number;
        quote: number;
    };
}

// INTERFAZ PARA LOS PUNTOS DE DATOS DEL HISTORIAL DE VELAS (OHLCV + Indicadores)
export interface MarketPriceDataPoint {
    timestamp: number; // Unix timestamp en milisegundos de la apertura de la vela
    openPrice: number;  // Precio de apertura de la vela
    highPrice: number;  // Precio más alto de la vela
    lowPrice: number;   // Precio más bajo de la vela
    closePrice: number; // Precio de cierre de la vela (anteriormente 'price')
    volume: number;     // Volumen de trading de la vela

    // Indicadores Técnicos
    sma10?: number;
    sma20?: number;
    sma50?: number;

    macdLine?: number;
    signalLine?: number;
    macdHistogram?: number;

    rsi?: number;

    upperBollingerBand?: number;
    middleBollingerBand?: number;
    lowerBollingerBand?: number;

    // Señales (se mantienen para compatibilidad con SmaCrossoverEvent, pero sin lógica de IA)
    aiBuySignal?: number; // Se mantiene la propiedad para evitar errores de tipo si aún se referencia en algún lugar
    aiSellSignal?: number; // Se mantiene la propiedad para evitar errores de tipo si aún se referencia en algún lugar
    smaCrossBuySignal?: number;
    smaCrossSellSignal?: number;
    //strategySignal?: 'buy' | 'sell' | 'hold';
    strategySignal?: TradeAction; // ✅ AJUSTE: Usar el tipo TradeAction definido
}

// CONFIGURACIÓN DE GRÁFICOS (ÚNICA DECLARACIÓN)
export const marketPriceChartConfigDark = {
    // La clave principal para el precio a mostrar en gráficos debe ser closePrice.
    // 'price' se mantiene como referencia si algún componente aún lo usa como fallback, pero idealmente se usa closePrice.
    price: { label: "Precio (Legado)", color: "hsl(var(--chart-1))" }, // Cambiado a 'Precio (Legado)' para diferenciar
    closePrice: { label: "Cierre", color: "hsl(var(--chart-1))" }, // Nuevo y principal para precios de velas
    openPrice: { label: "Apertura", color: "hsl(var(--chart-1))" },
    highPrice: { label: "Máximo", color: "hsl(var(--chart-1))" },
    lowPrice: { label: "Mínimo", color: "hsl(var(--chart-1))" },
    volume: { label: "Volumen", color: "hsl(var(--chart-2))" }, // Asigna un color al volumen

    sma10: { label: "SMA 10", color: "hsl(var(--chart-5))" },
    sma20: { label: "SMA 20", color: "hsl(var(--chart-2))" },
    sma50: { label: "SMA 50 (Ref. Bot)", color: "hsl(var(--chart-4))" },
    aiBuySignal: { label: "Señal AI (Compra)", color: "hsl(var(--chart-3))" }, 
    aiSellSignal: { label: "Señal AI (Venta)", color: "hsl(var(--destructive))" },
    smaCrossBuySignal: { label: "Cruce SMA (Compra)", color: "hsl(var(--chart-3) / 0.7)" },
    smaCrossSellSignal: { label: "Cruce SMA (Venta)", color: "hsl(var(--destructive) / 0.7)" },
    macdLine: { label: "MACD Line", color: "hsl(var(--chart-6))" },
    signalLine: { label: "MACD Signal", color: "hsl(var(--chart-7))" },
    macdHistogram: { label: "MACD Histograma", color: "hsl(var(--chart-8))" }, 
    rsi: { label: "RSI", color: "hsl(var(--chart-9))" },
    upperBollingerBand: { label: "Banda Bollinger Superior", color: "hsl(var(--chart-10))" },
    middleBollingerBand: { label: "Banda Bollinger Media", color: "hsl(var(--chart-11))" },
    lowerBollingerBand: { label: "Banda Bollinger Inferior", color: "hsl(var(--chart-12))" },
} satisfies ChartConfig;


// OTRAS INTERFACES RELACIONADAS CON SEÑALES Y RENDIMIENTO
export interface SignalItem {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
}

// **ELIMINADO: AISignalData - No utilizaremos IA**
// export interface AISignalData { ... }

export type ParsedSignals = SignalItem[];

// INTERFAZ OrderFormData
export interface OrderFormData {
    symbol: string;
    side: 'BUY' | 'SELL'; 
    orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT'; 
    quantity: number;
    price?: number; 
    stopPrice?: number; 
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
    // Se mantiene 'price' para eventos históricos, entendiendo que se refiere al closePrice de la vela en ese momento.
    price: number; 
    type: 'BUY' | 'SELL'; 
    confidence: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
}

export interface SmaCrossoverEvent {
    timestamp: number;
    // Se mantiene 'price' para eventos históricos, entendiendo que se refiere al closePrice de la vela en ese momento.
    price: number; 
    type: 'SMA_CROSS_BUY' | 'SMA_CROSS_SELL';
}

// INTERFAZ BotOpenPosition
export interface BotOpenPosition {
    marketId: string;
    entryPrice: number;
    amount: number;
    type: 'buy' | 'sell'; 
    timestamp: number;
    stopLossPrice?: number; 
    takeProfitPrice?: number; 
}

// **ELIMINADO: exampleHistoricalDataForAI - No utilizaremos IA**
// export const exampleHistoricalDataForAI = JSON.stringify([...]);


// INTERFACES DE BALANCE
export interface Balance {
    available: number;
    onOrder: number;
    total: number;
}

export interface BinanceBalance {
    asset: string;
    free: number;
    locked: number;
}

// INTERFACES DE RESPUESTA DE ENDPOINT
export interface BinanceOrderResult {
    symbol: string;
    orderId: number;
    clientOrderId: string;
    transactTime: number; 
    price: string; 
    origQty: string; 
    executedQty: string; 
    cummulativeQuoteQty: string; 
    status: string; 
    timeInForce?: string;
    type: string; 
    side: string; 
    fills?: Array<{
        price: string;
        qty: string;
        commission: string;
        commissionAsset: string;
        tradeId: number;
    }>;
}

/*
export interface TradeEndpointResponse {
    success: boolean;
    message?: string;
    details?: BinanceOrderResult | any; 
    error?: string; 
}
*/

// ✅ AJUSTE CRÍTICO: TradeEndpointResponse ahora extiende ApiResult para consistencia.
// La propiedad 'data' para el resultado de la orden se manejará a través de ApiResult<BinanceOrderResult>.
export interface TradeEndpointResponse extends ApiResult<BinanceOrderResult> {
    // Las propiedades 'success', 'message', 'error', 'data', 'details' ya son heredadas de ApiResult.
    // No es necesario re-declararlas aquí.
}

// INTERFACES DE RESPUESTA DE ENDPOINT
// ... (otras interfaces de respuesta) ...

// ✅ AJUSTE CRÍTICO: Estructura de respuesta estandarizada para los endpoints de API.
export interface ApiResult<T> {
    success: boolean;
    message?: string;
    error?: string;
    data?: T;
    details?: any; // Para cualquier detalle adicional del error o éxito
}

// Tipo de dato para una vela (Kline) según el formato raw de Binance/CCXT
// [timestamp, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore]
export type KLine = number[]; // ✅ AJUSTE CRÍTICO: Asegura que KLine es exportado y definido.



// En src/lib/types.ts
export interface BotActionDetails {
    type: 'start' | 'stop' | 'order_placed' | 'order_failed' | 'strategy_decision' | 'orderPlaced' | 'strategyExecuted';
    success: boolean;
    timestamp: number; // ✅ AJUSTE CRÍTICO: Añadida propiedad 'timestamp' aquí.
    message?: string; // Aseguramos que 'message' es opcional
    details?: any; // 'details' puede contener cualquier objeto para depuración
    data?: { // <-- AGREGAMOS ESTA PROPIEDAD 'data'
        action?: 'buy' | 'sell' | 'hold'; // Para especificar el tipo de decisión de la estrategia
        [key: string]: any; // Permite otras propiedades flexibles si se necesitan
    };
}

// INTERFACES DE PROPS PARA COMPONENTES Y HOOKS
export interface UseTradingBotProps {
    selectedMarket: Market;
    // currentMarketPriceHistory ahora contendrá MarketPriceDataPoint con OHLCV
    currentMarketPriceHistory: MarketPriceDataPoint[]; 
    currentPrice: number | null; // Este ahora será el closePrice de la última vela
    allBinanceBalances: Record<string, Balance>;
    onPlaceOrder: (orderData: OrderFormData) => Promise<boolean>; 
    botIntervalMs: number;
    isBotRunning: boolean;
    setIsBotRunning: (isRunning: boolean) => void;
    onBotAction?: (details: BotActionDetails) => void; 
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
}

export interface MarketPriceChartProps {
    marketId: string;
    marketName: string;
    // priceHistory ahora contendrá MarketPriceDataPoint con OHLCV
    priceHistory: MarketPriceDataPoint[]; 
    smaCrossoverEvents: SmaCrossoverEvent[];
    aiSignalEvents: SignalEvent[]; // Se mantiene por si hay componentes de UI que aún los referencian.
    isBotActive: boolean;
}

export interface TradeFormProps {
    market: Market;
    currentPrice: number | null;
    availableQuoteBalance: number;
    cavailableBaseBalance: number;
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
}


export type TradeAction = 'buy' | 'sell' | 'hold';















export interface MarketRulesDisplayProps {
    marketRules: MarketRules | null;
    isLoading: boolean;
    error: string | null;
}
export interface MarketListProps {
    markets: Market[];
    selectedMarketId: string | null;
    onSelectMarket: (marketId: string) => void;
    isLoading: boolean;
    error: string | null;
}
export interface MarketDetailsProps {
    market: Market | null;
    marketRules: MarketRules | null;
    isLoading: boolean;
    error: string | null;
}
export interface PerformanceChartProps {
    performanceData: PerformanceDataPoint[];
    chartConfig: ChartConfig;
    isLoading: boolean;
    error: string | null;
}
export interface SignalEventsDisplayProps {
    signalEvents: SignalEvent[];
    smaCrossoverEvents: SmaCrossoverEvent[];
    isLoading: boolean;
    error: string | null;
}
