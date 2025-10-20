// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

import {
    Market,
    MarketRules,
    BinanceBalance,
    OrderFormData,
    BotOpenPosition,
    BotActionDetails,
    MarketPriceDataPoint,
    PRICE_HISTORY_POINTS_TO_KEEP,
    ApiResult,
    KLine,
    TradeEndpointResponse
} from '@/lib/types';

import { decideTradeActionAndAmount } from '@/lib/strategies/tradingStrategy';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands } from '@/lib/indicators';

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

export const useTradingBot = (props: {
    selectedMarket: Market | null;
    allBinanceBalances: BinanceBalance[];
    onBotAction?: (details: BotActionDetails) => void;
}) => {
    const { selectedMarket, allBinanceBalances, onBotAction = () => {} } = props;

    const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
    const [botOpenPosition, setBotOpenPosition] = useState<BotOpenPosition | null>(null);
    const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
    const [placeOrderError, setPlaceOrderError] = useState<string | null>(null);
    const [selectedMarketRules, setSelectedMarketRules] = useState<MarketRules | null>(null);
    const [rulesLoading, setRulesLoading] = useState<boolean>(true);
    const [rulesError, setRulesError] = useState<string | null>(null);
    const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
    const [botIntervalMs] = useState(5000); // Frecuencia de ejecución de la estrategia (5 segundos)

    const { toast } = useToast();
    const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(false);

    const logAction = useCallback((message: string, success: boolean, type: BotActionDetails['type'], details?: any, data?: any) => {
        onBotAction({ type, success, message, details, data, timestamp: Date.now() });
    }, [onBotAction]);

    const annotateMarketPriceHistory = useCallback((klines: KLine[]): MarketPriceDataPoint[] => {
        if (!klines || klines.length === 0) return [];
        const annotatedHistory: MarketPriceDataPoint[] = [];

        const closes = klines.map(k => k[4]).filter(isValidNumber);
        if (closes.length !== klines.length) {
            console.warn("Algunas velas no tienen precio de cierre válido.");
            return [];
        }

        for (let i = 0; i < klines.length; i++) {
            const currentCloses = klines.slice(0, i + 1).map(k => k[4]);
            const klineItem = klines[i];

            if (!Array.isArray(klineItem) || klineItem.length < 6) continue;
            const [timestamp, openPrice, highPrice, lowPrice, closePrice, volume] = klineItem;
            if (![timestamp, openPrice, highPrice, lowPrice, closePrice, volume].every(isValidNumber)) continue;
            
            const prevKline = i > 0 ? klines[i - 1] : null;

            // --- Cálculos de Indicadores ---
            const sma10 = calculateSMA(currentCloses, 10);
            const sma20 = calculateSMA(currentCloses, 20);
            const sma50 = calculateSMA(currentCloses, 50);
            const rsi = calculateRSI(currentCloses, 14);
            const macd = calculateMACD(currentCloses, 12, 26, 9);
            const bb = calculateBollingerBands(currentCloses, 20, 2);

            // --- Conteo de Condiciones de Estrategia ---
            let buyConditionsMet = 0;
            let sellConditionsMet = 0;

            if (isValidNumber(closePrice) && isValidNumber(bb.lower)) {
                if (closePrice <= bb.lower) buyConditionsMet++;
            }
            if (isValidNumber(rsi) && rsi <= 35) {
                buyConditionsMet++;
            }
            if (isValidNumber(macd.macdHistogram) && prevKline) {
                 const prevMacd = calculateMACD(klines.slice(0, i).map(k => k[4]), 12, 26, 9);
                 if (isValidNumber(prevMacd.macdHistogram) && macd.macdHistogram > 0 && prevMacd.macdHistogram <= 0) {
                     buyConditionsMet++;
                 }
            }
            
            if (isValidNumber(closePrice) && isValidNumber(bb.upper)) {
                if (closePrice >= bb.upper) sellConditionsMet++;
            }
            if (isValidNumber(rsi) && rsi >= 65) {
                sellConditionsMet++;
            }
            
            annotatedHistory.push({
                timestamp, openPrice, highPrice, lowPrice, closePrice, volume,
                sma10, sma20, sma50, rsi,
                macdLine: macd.macdLine,
                signalLine: macd.signalLine,
                macdHistogram: macd.macdHistogram,
                upperBollingerBand: bb.upper,
                middleBollingerBand: bb.middle,
                lowerBollingerBand: bb.lower,
                // --- Nuevos campos de conteo ---
                buyConditionsMet,
                sellConditionsMet,
            });
        }
        return annotatedHistory;
    }, []);

    const executeBotStrategy = useCallback(async () => {
        if (!isBotRunning || !selectedMarket || currentPrice === null || currentMarketPriceHistory.length < 30 || !selectedMarketRules || isPlacingOrder) {
            return;
        }
        
        const decision = decideTradeActionAndAmount({
            selectedMarket,
            currentMarketPriceHistory,
            currentPrice,
            allBinanceBalances,
            botOpenPosition,
            selectedMarketRules,
            logStrategyMessage: (message, details) => logAction(message, true, 'strategy_decision', details, { action: 'hold' })
        });
        
        logAction(`Decisión de la estrategia: ${decision.action.toUpperCase()}`, true, 'strategy_decision', { decisionDetails: decision.details }, { action: decision.action });

        if (decision.action !== 'hold' && decision.orderData) {
            if (isPlacingOrder) return;
            setIsPlacingOrder(true);
            setPlaceOrderError(null);
            
            const orderDetails = {
                symbol: decision.orderData.symbol,
                side: decision.orderData.side,
                type: decision.orderData.orderType,
                amount: decision.orderData.quantity,
                price: decision.orderData.price
            };
            
            logAction(`Intento de orden: ${orderDetails.side} ${orderDetails.amount} ${orderDetails.symbol}`, true, 'order_placed', orderDetails);
            
            try {
                const response = await fetch('/api/binance/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderDetails) });
                const result: TradeEndpointResponse = await response.json();
                
                if (!response.ok || !result.success) {
                    const errorMessage = result.message || result.details || "Error desconocido al colocar la orden.";
                    setPlaceOrderError(errorMessage);
                    logAction(`FALLO al colocar orden: ${errorMessage}`, false, 'order_failed', { error: errorMessage, orderData: orderDetails });
                    toast({ title: "Error al colocar orden", description: errorMessage, variant: "destructive" });
                } else {
                    setBotLastActionTimestamp(Date.now());
                    if (decision.action === 'buy') {
                        setBotOpenPosition({ marketId: selectedMarket.id, entryPrice: currentPrice, amount: orderDetails.amount, type: 'buy', timestamp: Date.now() });
                        toast({ title: "¡Orden de Compra Exitosa!", variant: "default" });
                    } else if (decision.action === 'sell') {
                        setBotOpenPosition(null);
                        toast({ title: "¡Orden de Venta Exitosa!", variant: "default" });
                    }
                    logAction(`ÉXITO al colocar orden ${decision.action.toUpperCase()}`, true, 'order_placed', result.data);
                }
            } catch (error: any) {
                const errorMessage = error.message || "Error de conexión con la API.";
                setPlaceOrderError(errorMessage);
                logAction(`FALLO de red al colocar orden: ${errorMessage}`, false, 'order_failed', { error: errorMessage, orderData: orderDetails });
                toast({ title: "Error de conexión", description: errorMessage, variant: "destructive" });
            } finally {
                if(isMounted.current) setIsPlacingOrder(false);
            }
        }
    }, [ isBotRunning, selectedMarket, currentMarketPriceHistory, currentPrice, allBinanceBalances, botOpenPosition, selectedMarketRules, isPlacingOrder, toast, logAction ]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    
    const toggleBotStatus = useCallback(() => {
        setIsBotRunning(prev => {
            const newStatus = !prev;
            logAction(`Bot ${newStatus ? 'iniciado' : 'detenido'}`, true, newStatus ? 'start' : 'stop');
            if (isMounted.current) {
                toast({
                    title: `Bot ${newStatus ? 'iniciado' : 'detenido'}`,
                    description: `El bot para ${selectedMarket?.symbol || 'mercado seleccionado'} ha sido ${newStatus ? 'iniciado' : 'detenido'}.`,
                    variant: newStatus ? 'default' : 'destructive',
                });
            }
            return newStatus;
        });
    }, [selectedMarket?.symbol, toast, logAction]);

    useEffect(() => {
        const fetchInitialData = async () => {
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

            if (!isMounted.current) return;
            setRulesLoading(true);
            setRulesError(null);
            setIsDataLoaded(false);

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
                    symbol: marketInfo.symbol,
                    status: marketInfo.active ? 'TRADING' : 'BREAK',
                    baseAsset: marketInfo.baseAsset,
                    quoteAsset: marketInfo.quoteAsset,
                    lotSize: {
                        minQty: parseFloat(lotSizeFilter?.minQty) || 0,
                        maxQty: parseFloat(lotSizeFilter?.maxQty) || 0,
                        stepSize: parseFloat(lotSizeFilter?.stepSize) || 0,
                    },
                    minNotional: {
                        minNotional: parseFloat(minNotionalFilter?.minNotional || minNotionalFilter?.notional) || 0,
                    },
                    priceFilter: {
                        minPrice: parseFloat(priceFilter?.minPrice) || 0,
                        maxPrice: parseFloat(priceFilter?.maxPrice) || 0,
                        tickSize: parseFloat(priceFilter?.tickSize) || 0,
                    },
                    precision: {
                        price: marketInfo.pricePrecision,
                        amount: marketInfo.amountPrecision,
                        base: marketInfo.baseAssetPrecision,
                        quote: marketInfo.quotePrecision,
                    },
                    baseAssetPrecision: marketInfo.baseAssetPrecision,
                    quotePrecision: marketInfo.quotePrecision,
                    icebergAllowed: marketInfo.icebergAllowed || false,
                    ocoAllowed: marketInfo.ocoAllowed || false,
                    quoteOrderQtyMarketAllowed: marketInfo.quoteOrderQtyMarketAllowed || false,
                    isSpotTradingAllowed: marketInfo.isSpotTradingAllowed || false,
                    isMarginTradingAllowed: marketInfo.isMarginTradingAllowed || false,
                    filters: marketInfo.filters || [],
                };
                
                if (isMounted.current) setSelectedMarketRules(parsedRules);

            } catch (error: any) {
                if (isMounted.current) {
                    setRulesError(error.message);
                    toast({ title: "Error al Cargar Reglas", description: error.message, variant: "destructive" });
                }
            } finally {
                if (isMounted.current) setRulesLoading(false);
            }

            try {
                const klinesResponse = await fetch(`/api/binance/klines?symbol=${selectedMarket.symbol}&interval=1m&limit=${PRICE_HISTORY_POINTS_TO_KEEP}`);
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
                } else {
                    if (isMounted.current) setIsDataLoaded(false);
                }
            } catch (error: any) {
                if (isMounted.current) {
                    toast({ title: "Advertencia al Cargar Gráfico", description: error.message, variant: "destructive" });
                    setCurrentMarketPriceHistory([]); setIsDataLoaded(false);
                }
            }

        };
        fetchInitialData();
    }, [selectedMarket?.symbol, toast, annotateMarketPriceHistory]);

    useEffect(() => {
        if (isBotRunning && isDataLoaded) {
            botIntervalRef.current = setInterval(executeBotStrategy, botIntervalMs);
            executeBotStrategy();
        } else {
            if (botIntervalRef.current) clearInterval(botIntervalRef.current);
        }
        return () => { if (botIntervalRef.current) clearInterval(botIntervalRef.current); };
    }, [isBotRunning, isDataLoaded, executeBotStrategy, botIntervalMs]);

    return {
        isBotRunning, toggleBotStatus, botOpenPosition, botLastActionTimestamp,
        isPlacingOrder, placeOrderError, selectedMarketRules, rulesLoading, rulesError,
        currentPrice, currentMarketPriceHistory
    };
};

    