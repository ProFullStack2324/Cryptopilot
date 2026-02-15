
// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

import {
    Market,
    MarketRules,
    BinanceBalance,
    BotOpenPosition,
    BotActionDetails,
    MarketPriceDataPoint,
    PRICE_HISTORY_POINTS_TO_KEEP,
    ApiResult,
    KLine,
    TradeEndpointResponse,
    OrderFormData
} from '@/lib/types';

import { decideTradeActionAndAmount } from '@/lib/strategies/tradingStrategy';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR, calculateADX } from '@/lib/indicators';

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// ======================================================================================================
// CONFIGURACIÓN DE LA ESTRATEGIA
// ======================================================================================================
const STRATEGY_CONFIG = {
    scalping: {
        minBuyConditions: 1,
        takeProfitPercentage: 0.008, // 0.8%
        stopLossPercentage: 0.004,   // 0.4%
        capitalToRiskPercentage: 0.95 
    },
    sniper: {
        minBuyConditions: 2,
        takeProfitPercentage: 0.02,  // 2%
        stopLossPercentage: 0.01,    // 1%
        capitalToRiskPercentage: 0.95
    },
    rsiSellThreshold: 65,
};

export const MIN_REQUIRED_HISTORY_FOR_BOT = 51; // Requisito mínimo de velas para operar

export const useTradingBot = (props: {
    selectedMarket: Market | null;
    allBinanceBalances: BinanceBalance[];
    onBotAction?: (details: BotActionDetails) => void;
    timeframe: string;
}) => {
    const { selectedMarket, allBinanceBalances, onBotAction = () => {}, timeframe } = props;

    const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
    const [botOpenPosition, setBotOpenPosition] = useState<BotOpenPosition | null>(null);
    const [simulatedPosition, setSimulatedPosition] = useState<BotOpenPosition | null>(null);
    const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
    const [placeOrderError, setPlaceOrderError] = useState<string | null>(null);
    const [selectedMarketRules, setSelectedMarketRules] = useState<MarketRules | null>(null);
    const [rulesLoading, setRulesLoading] = useState<boolean>(true);
    const [rulesError, setRulesError] = useState<string | null>(null);
    const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

    const { toast } = useToast();
    const isMounted = useRef(false);

    // NUEVO: Sincronización con el servidor
    const fetchBotStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/bot/status', {
                headers: { 'x-api-key': process.env.NEXT_PUBLIC_BOT_API_KEY || '' }
            });
            const result = await response.json();
            if (result.success && isMounted.current) {
                setIsBotRunning(result.data.isRunning);
            }
        } catch (error) {
            console.error("Failed to fetch bot status", error);
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchBotStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchBotStatus]);

    const toggleBotStatus = useCallback(async () => {
        const newStatus = !isBotRunning;
        const action = newStatus ? 'start' : 'stop';
        
        try {
            const response = await fetch('/api/bot/toggle', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.NEXT_PUBLIC_BOT_API_KEY || ''
                },
                body: JSON.stringify({ action, market: selectedMarket, timeframe })
            });
            const result = await response.json();

            if (result.success) {
                setIsBotRunning(newStatus);
                onBotAction({ type: action, success: true, message: `Bot ${newStatus ? 'iniciado' : 'detenido'} en el servidor`, timestamp: Date.now() });
                toast({
                    title: `Bot ${newStatus ? 'iniciado' : 'detenido'}`,
                    description: `El bot para ${selectedMarket?.symbol || 'mercado'} se está ejecutando en el servidor.`,
                    variant: newStatus ? 'default' : 'destructive',
                });
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error de red", description: error.message, variant: "destructive" });
        }
    }, [isBotRunning, selectedMarket, timeframe, onBotAction, toast]);

    const executeOrder = useCallback(async (orderData: Omit<OrderFormData, 'symbol' | 'orderType'> & { side: 'buy' | 'sell'; amount: number }, strategyForOrder: 'scalping' | 'sniper') => {
        if (isPlacingOrder) return false;
        if (!selectedMarket) {
            onBotAction({ type: 'order_failed', success: false, message: "FALLO al colocar orden: No hay mercado seleccionado.", timestamp: Date.now() });
            return false;
        }
    
        setIsPlacingOrder(true);
        setPlaceOrderError(null);
    
        const finalOrderData = {
            symbol: selectedMarket.symbol,
            type: 'market',
            side: orderData.side,
            amount: orderData.amount,
            price: orderData.price,
        };
    
        onBotAction({ type: 'order_placed', success: true, message: `Intento de orden (${strategyForOrder}): ${finalOrderData.side} ${finalOrderData.amount} ${finalOrderData.symbol}`, details: finalOrderData, timestamp: Date.now() });
    
        try {
            const response = await fetch('/api/binance/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalOrderData) });
            const result: TradeEndpointResponse = await response.json();
    
            if (!response.ok || !result.success) {
                const errorMessage = result.message || result.details || "Error desconocido al colocar la orden.";
                setPlaceOrderError(errorMessage);
                onBotAction({ type: 'order_failed', success: false, message: `FALLO al colocar orden: ${errorMessage}`, details: { error: errorMessage, orderData: finalOrderData }, timestamp: Date.now() });
                toast({ title: "Error al colocar orden", description: errorMessage, variant: "destructive" });
                return false;
            } else {
                // Configuración simplificada para el estado local
                const tpPerc = strategyForOrder === 'sniper' ? 0.035 : 0.012;
                const slPerc = strategyForOrder === 'sniper' ? 0.015 : 0.006;
                
                setBotLastActionTimestamp(Date.now());
                if (finalOrderData.side === 'buy' && result.data?.price) {
                    const entryPrice = parseFloat(result.data.price);
                    const takeProfitPrice = entryPrice * (1 + tpPerc);
                    const stopLossPrice = entryPrice * (1 - slPerc);
                    setBotOpenPosition({
                        marketId: selectedMarket.id,
                        entryPrice: entryPrice,
                        amount: finalOrderData.amount,
                        type: 'buy',
                        timestamp: Date.now(),
                        takeProfitPrice,
                        stopLossPrice,
                        strategy: strategyForOrder,
                    });
                    toast({ title: `¡Orden de Compra (${strategyForOrder}) Exitosa!`, variant: "default" });
                } else if (finalOrderData.side === 'sell') {
                    setBotOpenPosition(null);
                    toast({ title: "¡Orden de Venta Exitosa!", variant: "default" });
                }
                onBotAction({ type: 'order_placed', success: true, message: `ÉXITO al colocar orden ${finalOrderData.side}`, details: result.data, timestamp: Date.now() });
                return true;
            }
        } catch (error: any) {
            const errorMessage = error.message || "Error de conexión con la API.";
            setPlaceOrderError(errorMessage);
            onBotAction({ type: 'order_failed', success: false, message: `FALLO de red al colocar orden: ${errorMessage}`, details: { error: errorMessage, orderData: finalOrderData }, timestamp: Date.now() });
            toast({ title: "Error de conexión", description: errorMessage, variant: "destructive" });
            return false;
        } finally {
            if (isMounted.current) setIsPlacingOrder(false);
        }
    }, [isPlacingOrder, onBotAction, toast, selectedMarket]);
    
    const annotateMarketPriceHistory = useCallback((klines: KLine[]): MarketPriceDataPoint[] => {
        if (!klines || klines.length === 0) return [];
        const annotatedHistory: MarketPriceDataPoint[] = [];

        const closes = klines.map(k => k[4]).filter(isValidNumber);
        if (closes.length < 2) return [];

        for (let i = 0; i < klines.length; i++) {
            const currentCloses = klines.slice(0, i + 1).map(k => k[4]);
            const klineItem = klines[i];

            if (!Array.isArray(klineItem) || klineItem.length < 6) continue;
            const [timestamp, openPrice, highPrice, lowPrice, closePrice, volume] = klineItem;
            if (![timestamp, openPrice, highPrice, lowPrice, closePrice, volume].every(isValidNumber)) continue;
            
            const sma10 = calculateSMA(currentCloses, 10);
            const sma20 = calculateSMA(currentCloses, 20);
            const sma50 = calculateSMA(currentCloses, 50);
            const rsi = calculateRSI(currentCloses, 14);
            const macd = calculateMACD(currentCloses, 12, 26, 9);
            const bb = calculateBollingerBands(currentCloses, 20, 2);

            const currentHighs = klines.slice(0, i + 1).map(k => k[2]);
            const currentLows = klines.slice(0, i + 1).map(k => k[3]);
            const atr = calculateATR(currentHighs, currentLows, currentCloses, 14);
            const adx = calculateADX(currentHighs, currentLows, currentCloses, 14);

            annotatedHistory.push({
                timestamp, openPrice, highPrice, lowPrice, closePrice, volume,
                sma10, sma20, sma50, rsi,
                macdHistogram: macd.macdHistogram,
                upperBollingerBand: bb.upper,
                lowerBollingerBand: bb.lower,
                atr: !isNaN(atr) ? atr : undefined,
                adx: !isNaN(adx) ? adx : undefined,
            });
        }
        return annotatedHistory;
    }, []);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!selectedMarket?.symbol) {
            if (isMounted.current) {
                setSelectedMarketRules(null);
                setRulesLoading(false);
                setCurrentMarketPriceHistory([]);
                setCurrentPrice(null);
                setIsDataLoaded(false);
            }
            return;
        }

        const fetchMarketData = async () => {
            if (!isMounted.current) return;
            setRulesLoading(true);
            setRulesError(null);
            
            try {
                const rulesResponse = await fetch(`/api/binance/exchange-info?symbol=${selectedMarket.symbol}`);
                const rulesData: ApiResult<any> = await rulesResponse.json();
                
                if (!rulesResponse.ok || !rulesData.success) {
                    throw new Error(rulesData.message || `Error al cargar reglas del mercado.`);
                }
                
                const marketInfo = rulesData.data;
                const lotSizeFilter = marketInfo.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
                const minNotionalFilter = marketInfo.filters?.find((f: any) => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL');
                const priceFilter = marketInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');

                const parsedRules: MarketRules = {
                    symbol: marketInfo.symbol, status: marketInfo.active ? 'TRADING' : 'BREAK', baseAsset: marketInfo.baseAsset, quoteAsset: marketInfo.quoteAsset,
                    lotSize: { minQty: parseFloat(lotSizeFilter?.minQty) || 0, maxQty: parseFloat(lotSizeFilter?.maxQty) || 0, stepSize: parseFloat(lotSizeFilter?.stepSize) || 0 },
                    minNotional: { minNotional: parseFloat(minNotionalFilter?.minNotional || minNotionalFilter?.notional) || 0 },
                    priceFilter: { minPrice: parseFloat(priceFilter?.minPrice) || 0, maxPrice: parseFloat(priceFilter?.maxPrice) || 0, tickSize: parseFloat(priceFilter?.tickSize) || 0 },
                    precision: { price: marketInfo.pricePrecision, amount: marketInfo.amountPrecision, base: marketInfo.baseAssetPrecision, quote: marketInfo.quotePrecision },
                    baseAssetPrecision: marketInfo.baseAssetPrecision, quotePrecision: marketInfo.quotePrecision, icebergAllowed: marketInfo.icebergAllowed || false,
                    ocoAllowed: marketInfo.ocoAllowed || false, quoteOrderQtyMarketAllowed: marketInfo.quoteOrderQtyMarketAllowed || false, isSpotTradingAllowed: marketInfo.isSpotTradingAllowed || false,
                    isMarginTradingAllowed: marketInfo.isMarginTradingAllowed || false, filters: marketInfo.filters || [],
                };
                
                if (isMounted.current) setSelectedMarketRules(parsedRules);

                const klinesResponse = await fetch(`/api/binance/klines?symbol=${selectedMarket.symbol}&interval=${timeframe}&limit=${PRICE_HISTORY_POINTS_TO_KEEP}`);
                const klinesData: ApiResult<KLine[]> = await klinesResponse.json();
                if (!klinesResponse.ok || !klinesData.success) throw new Error(klinesData.message || "Error al cargar velas (klines).");
                const klinesArray = klinesData.data || (klinesData as any).klines;
                if (Array.isArray(klinesArray) && klinesArray.length > 0) {
                    const historyWithIndicators = annotateMarketPriceHistory(klinesArray);
                    if (isMounted.current) {
                        setCurrentMarketPriceHistory(historyWithIndicators);
                        setCurrentPrice(historyWithIndicators.at(-1)?.closePrice || null);
                        setIsDataLoaded(true);
                    }
                }
            } catch (error: any) {
                if (isMounted.current) setRulesError(error.message);
            } finally {
                if (isMounted.current) setRulesLoading(false);
            }
        };

        fetchMarketData();
        const initialDataInterval = setInterval(fetchMarketData, 30000);
        return () => clearInterval(initialDataInterval);
    }, [selectedMarket?.symbol, timeframe, annotateMarketPriceHistory]);

    return {
        isBotRunning, toggleBotStatus, botOpenPosition, botLastActionTimestamp,
        isPlacingOrder, placeOrderError, selectedMarketRules, rulesLoading, rulesError,
        currentPrice, currentMarketPriceHistory, simulatedPosition
    };
};
