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
    pricePrecision: number; 
    amountPrecision: number; 
    latestPrice: number | null; 
    change24h: number | null; 
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
    filters: Array<any>; 
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
    precision: {
        price: number;
        amount: number;
        base: number;
        quote: number;
    };
}

// INTERFAZ PARA LOS PUNTOS DE DATOS DEL HISTORIAL DE VELAS (OHLCV + Indicadores)
export interface MarketPriceDataPoint {
    timestamp: number;
    openPrice: number;
    highPrice: number;
    lowPrice: number;
    closePrice: number;
    volume: number;

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

    strategySignal?: TradeAction;

    // Conteo de condiciones para la visualización de zonas
    buyConditionsMet?: number;
    sellConditionsMet?: number;
}

// CONFIGURACIÓN DE GRÁFICOS (ÚNICA DECLARACIÓN)
export const marketPriceChartConfigDark = {
    price: { label: "Precio", color: "hsl(var(--chart-1))" },
    closePrice: { label: "Cierre", color: "hsl(var(--chart-1))" },
    sma10: { label: "SMA 10", color: "hsl(var(--chart-5))" },
    sma20: { label: "SMA 20", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;


// OTRAS INTERFACES RELACIONADAS CON SEÑALES Y RENDIMIENTO
export interface SignalItem {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
}

export type ParsedSignals = SignalItem[];

// INTERFAZ OrderFormData
export interface OrderFormData {
    symbol: string;
    side: 'BUY' | 'SELL'; 
    orderType: 'MARKET' | 'LIMIT';
    quantity: number;
    price?: number; 
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
    type: string; 
    side: string; 
}

export interface TradeEndpointResponse extends ApiResult<BinanceOrderResult> {}

export interface ApiResult<T> {
    success: boolean;
    message?: string;
    error?: string;
    data?: T;
    details?: any;
}

export type KLine = [number, number, number, number, number, number, ...any[]];

export interface BotActionDetails {
    type: 'start' | 'stop' | 'order_placed' | 'order_failed' | 'strategy_decision';
    success: boolean;
    timestamp: number;
    message?: string;
    details?: any;
    data?: any;
}


export type TradeAction = 'buy' | 'sell' | 'hold' | 'hold_insufficient_funds';

export interface BinanceBalancesDisplayProps {
    balances: Record<string, Balance>;
    isLoading: boolean;
    error: string | null;
}

    