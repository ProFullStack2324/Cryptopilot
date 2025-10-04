// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

import {
    Market,
    MarketRules,
    BinanceBalance,
    OrderFormData,
    BinanceOrderResult,
    BotOpenPosition,
    BotActionDetails,
    MarketPriceDataPoint,
    PRICE_HISTORY_POINTS_TO_KEEP,
    ApiResult,
    KLine, // Importado como KLine (con L mayúscula)
    TradeEndpointResponse
} from '@/lib/types';

import { decideTradeActionAndAmount } from '@/lib/strategies/tradingStrategy';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands } from '@/lib/indicators';

// Helper para validar si un valor es un número válido (no undefined, null, NaN).
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// ======================================================================================================
// Hook Principal: useTradingBot
// ======================================================================================================
export const useTradingBot = (props: {
    selectedMarket: Market | null;
    allBinanceBalances: BinanceBalance[];
    onBotAction?: (details: BotActionDetails) => void;
}) => {
    const { selectedMarket, allBinanceBalances, onBotAction } = props;

    // ======================================================================================================
    // Estados del Bot
    // ======================================================================================================
    const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
    const [botOpenPosition, setBotOpenPosition] = useState<BotOpenPosition | null>(null);
    const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number | null>(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
    const [placeOrderError, setPlaceOrderError] = useState<string | null>(null);

    // Estado para las reglas del mercado
    const [selectedMarketRules, setSelectedMarketRules] = useState<MarketRules | null>(null);
    const [rulesLoading, setRulesLoading] = useState<boolean>(true);
    const [rulesError, setRulesError] = useState<string | null>(null);

    // ESTADOS PARA GESTIONAR EL HISTORIAL DE PRECIOS Y EL PRECIO ACTUAL
    const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false); 
    const [botIntervalMs, setBotIntervalMs] = useState(1000); // Frecuencia de ejecución de la estrategia (1 segundos por defecto)
    const [signalCounts, setSignalCounts] = useState({ buy: 0, sell: 0, hold: 0 });

    const { toast } = useToast();
    const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const priceFetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Bandera para controlar si el componente está montado.
    const isMounted = useRef(false);

    // ======================================================================================================
    // Callbacks de Utilidad (log, debug)
    // ======================================================================================================
    const log = useCallback((message: string, details?: any) => {
        console.log(`LOG: [${message}]`, details || '');
        if (onBotAction) {
            onBotAction({
                type: 'strategyExecuted',
                success: true,
                timestamp: Date.now(),
                message: message,
                data: details,
            });
        }
    }, [onBotAction]);

    const debug = useCallback((message: string, details?: any) => {
        console.debug(`DEBUG: ${message}`, details || '');
    }, []);

    // ======================================================================================================
    // Función Centralizada para Anotar el Historial con Indicadores
    // ======================================================================================================
    const annotateMarketPriceHistory = useCallback((klines: KLine[]): MarketPriceDataPoint[] => {
        if (!klines || klines.length === 0) {
            return [];
        }
    
        const annotatedHistory: MarketPriceDataPoint[] = [];
        const closes = klines.map(k => k[4]).filter(isValidNumber); // Obtener todos los precios de cierre válidos
    
        // Pre-calcular series de indicadores para eficiencia
        const sma10Series = calculateSMASeries(closes, 10);
        const sma20Series = calculateSMASeries(closes, 20);
        const sma50Series = calculateSMASeries(closes, 50);
        const rsiSeries = calculateRSISeries(closes, 14);
        const macdSeries = calculateMACDSeries(closes, 12, 26, 9);
        const bbSeries = calculateBollingerBandsSeries(closes, 20, 2);
    
        klines.forEach((klineItem, index) => {
            if (!Array.isArray(klineItem) || klineItem.length < 6 || !klineItem.every(isValidNumber)) {
                log(`[Annotate] Kline inválido en índice ${index}, saltando.`, klineItem);
                return;
            }
    
            const dataPoint: MarketPriceDataPoint = {
                timestamp: klineItem[0],
                openPrice: klineItem[1],
                highPrice: klineItem[2],
                lowPrice: klineItem[3],
                closePrice: klineItem[4],
                volume: klineItem[5],
                sma10: sma10Series[index],
                sma20: sma20Series[index],
                sma50: sma50Series[index],
                rsi: rsiSeries[index],
                macdLine: macdSeries[index]?.macdLine,
                signalLine: macdSeries[index]?.signalLine,
                macdHistogram: macdSeries[index]?.macdHistogram,
                upperBollingerBand: bbSeries[index]?.upper,
                middleBollingerBand: bbSeries[index]?.middle,
                lowerBollingerBand: bbSeries[index]?.lower,
            };
            annotatedHistory.push(dataPoint);
        });
    
        return annotatedHistory;
    }, [log]);
    
    // Funciones auxiliares para calcular series completas de indicadores
    const calculateSMASeries = (prices: number[], period: number) => prices.map((_, i) => calculateSMA(prices.slice(0, i + 1), period));
    const calculateRSISeries = (prices: number[], period: number) => prices.map((_, i) => calculateRSI(prices.slice(0, i + 1), period));
    const calculateMACDSeries = (prices: number[], fast: number, slow: number, signal: number) => prices.map((_, i) => calculateMACD(prices.slice(0, i + 1), fast, slow, signal));
    const calculateBollingerBandsSeries = (prices: number[], period: number, stdDev: number) => prices.map((_, i) => calculateBollingerBands(prices.slice(0, i + 1), period, stdDev));

    // ======================================================================================================
    // Lógica principal de la estrategia del bot (AHORA CON MONITOREO DE SL/TP)
    // ======================================================================================================
    const executeBotStrategy = useCallback(async () => {
        const minDataPointsForStrategy = 51; 

        if (!isBotRunning || !selectedMarket || currentPrice === null || currentMarketPriceHistory.length < minDataPointsForStrategy || !selectedMarketRules || isPlacingOrder) {
            return; 
        }

        let actionToExecute: 'buy' | 'sell' | 'hold' = 'hold';
        let orderDataToExecute: OrderFormData | undefined;

        if (botOpenPosition) {
            const { amount, stopLossPrice, takeProfitPrice } = botOpenPosition;

            if (stopLossPrice && currentPrice <= stopLossPrice) {
                actionToExecute = 'sell';
                orderDataToExecute = { symbol: selectedMarket.symbol, side: 'SELL', orderType: 'MARKET', quantity: amount, price: currentPrice };
                toast({ title: "¡Stop Loss Activado!", description: `Vendiendo ${amount} ${selectedMarket.baseAsset}.`, variant: "destructive" });
            }
            else if (takeProfitPrice && currentPrice >= takeProfitPrice) {
                actionToExecute = 'sell';
                orderDataToExecute = { symbol: selectedMarket.symbol, side: 'SELL', orderType: 'MARKET', quantity: amount, price: currentPrice };
                toast({ title: "¡Take Profit Activado!", description: `Vendiendo ${amount} ${selectedMarket.baseAsset}.` });
            }
        }

        if (actionToExecute === 'hold') { 
            const strategyDecision = decideTradeActionAndAmount({ selectedMarket, currentMarketPriceHistory, currentPrice, allBinanceBalances, botOpenPosition, selectedMarketRules, logStrategyMessage: (msg, details) => log(msg, details) });
            actionToExecute = strategyDecision.action;
            orderDataToExecute = strategyDecision.orderData;
        }

        if ((actionToExecute === 'buy' || actionToExecute === 'sell') && orderDataToExecute) {
            if (isPlacingOrder) return;

            setIsPlacingOrder(true); 
            setPlaceOrderError(null); 

            try {
                const response = await fetch('/api/binance/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderDataToExecute) });
                const tradeResult: TradeEndpointResponse = await response.json();
                if (!response.ok || !tradeResult.success) {
                    const errorMessage = tradeResult.error || tradeResult.message || "Error desconocido al colocar la orden.";
                    setPlaceOrderError(errorMessage);
                    toast({ title: "Error al colocar orden", description: errorMessage, variant: "destructive" });
                } else {
                    const orderDetails: BinanceOrderResult = tradeResult.data!;
                    setBotLastActionTimestamp(Date.now());
                    
                    if (actionToExecute === 'buy') {
                        const executedQtyNum = parseFloat(orderDetails.executedQty);
                        const cummulativeQuoteQtyNum = parseFloat(orderDetails.cummulativeQuoteQty);
                        const entryPrice = executedQtyNum > 0 ? cummulativeQuoteQtyNum / executedQtyNum : 0;
                        setBotOpenPosition({ marketId: selectedMarket.id, entryPrice, amount: executedQtyNum, type: 'buy', timestamp: orderDetails.transactTime });
                        toast({ title: "¡Orden de Compra Exitosa!", variant: "default" });
                    } else if (actionToExecute === 'sell') {
                        setBotOpenPosition(null);
                        toast({ title: "¡Orden de Venta Exitosa!", variant: "default" });
                    }
                }
            } catch (fetchError: any) {
                setPlaceOrderError(fetchError.message || "Error de conexión con la API.");
                toast({ title: "Error de conexión", description: fetchError.message, variant: "destructive" });
            } finally {
                if(isMounted.current) {
                    setIsPlacingOrder(false);
                }
            }
        }
    }, [ isBotRunning, selectedMarket, currentMarketPriceHistory, currentPrice, allBinanceBalances, botOpenPosition, selectedMarketRules, isPlacingOrder, toast, log ]);

    // ======================================================================================================
    // Efecto para gestionar la bandera isMounted.
    // ======================================================================================================
    useEffect(() => {
        isMounted.current = true; 
        return () => { isMounted.current = false; };
    }, []);

    const toggleBotStatus = useCallback(() => {
        setIsBotRunning(prev => {
            const nextState = !prev;
            if(selectedMarket){
                setTimeout(() => {
                    toast({
                        title: `Bot ${nextState ? 'iniciado' : 'detenido'}`,
                        description: `El bot para ${selectedMarket.symbol} ha sido ${nextState ? 'iniciado' : 'detenido'}.`,
                        variant: nextState ? 'default' : 'destructive',
                    });
                }, 100);
            }
            return nextState;
        });
    }, [selectedMarket, toast]);
    
    // ======================================================================================================
    // Efecto para la Carga Inicial de Reglas del Mercado y el Historial de Velas (OHLCV).
    // ======================================================================================================
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

            // Fetch Klines (primero, no depende de autenticación)
            try {
                const klinesResponse = await fetch(`/api/binance/klines?symbol=${selectedMarket.symbol}&interval=1m&limit=${PRICE_HISTORY_POINTS_TO_KEEP}`);
                if (!klinesResponse.ok) {
                    const errorData = await klinesResponse.json();
                    throw new Error(errorData.message || `Error HTTP al cargar velas: ${klinesResponse.status}`);
                }
                const klinesData: ApiResult<KLine[]> = await klinesResponse.json();

                const klinesArray = klinesData.data || (klinesData as any).klines;
                if (klinesData.success && Array.isArray(klinesArray) && klinesArray.length > 0) {
                    const historyWithIndicators = annotateMarketPriceHistory(klinesArray);
                    if (isMounted.current) {
                        setCurrentMarketPriceHistory(historyWithIndicators);
                        setCurrentPrice(historyWithIndicators[historyWithIndicators.length - 1]?.closePrice || null);
                        setIsDataLoaded(true); // Marcamos los datos como cargados para que la estrategia pueda empezar
                    }
                } else {
                    throw new Error("No se pudieron cargar velas históricas iniciales o el array está vacío.");
                }
            } catch (error: any) {
                if (isMounted.current) {
                    // No se establece un error fatal aquí, el gráfico simplemente podría estar vacío
                    toast({ title: "Advertencia al Cargar Gráfico", description: error.message, variant: "destructive" });
                    setCurrentMarketPriceHistory([]);
                    setIsDataLoaded(false); // Los datos no se cargaron, la estrategia no debe correr
                }
            }

            // Fetch Rules (segundo, puede fallar por autenticación sin detener el gráfico)
            try {
                const rulesResponse = await fetch(`/api/binance/exchange-info?symbol=${selectedMarket.symbol}`);
                if (!rulesResponse.ok) {
                    const errorData = await rulesResponse.json();
                    throw new Error(errorData.message || `Error HTTP al cargar reglas: ${rulesResponse.status}`);
                }
                const rulesData: ApiResult<any> = await rulesResponse.json();
                
                if (rulesData.success && rulesData.data) {
                    const ccxtMarketInfo = rulesData.data;
                    const lotSizeFilter = ccxtMarketInfo.info.filters.find((f: any) => f.filterType === 'LOT_SIZE');
                    const minNotionalFilter = ccxtMarketInfo.info.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
                    const priceFilter = ccxtMarketInfo.info.filters.find((f: any) => f.filterType === 'PRICE_FILTER');

                    const parsedRules: MarketRules = {
                        symbol: ccxtMarketInfo.symbol,
                        status: ccxtMarketInfo.active ? 'TRADING' : 'BREAK',
                        baseAsset: ccxtMarketInfo.base,
                        quoteAsset: ccxtMarketInfo.quote,
                        lotSize: { minQty: parseFloat(lotSizeFilter?.minQty || '0'), stepSize: parseFloat(lotSizeFilter?.stepSize || '0'), maxQty: parseFloat(lotSizeFilter?.maxQty || '0') },
                        minNotional: { minNotional: parseFloat(minNotionalFilter?.minNotional || '0') },
                        priceFilter: { minPrice: parseFloat(priceFilter?.minPrice || '0'), maxPrice: parseFloat(priceFilter?.maxPrice || '0'), tickSize: parseFloat(priceFilter?.tickSize || '0')},
                        precision: { price: ccxtMarketInfo.precision.price, amount: ccxtMarketInfo.precision.amount, base: ccxtMarketInfo.precision.base, quote: ccxtMarketInfo.precision.quote },
                        baseAssetPrecision: ccxtMarketInfo.precision.base,
                        quotePrecision: ccxtMarketInfo.precision.quote,
                        icebergAllowed: ccxtMarketInfo.info.icebergAllowed,
                        ocoAllowed: ccxtMarketInfo.info.ocoAllowed,
                        quoteOrderQtyMarketAllowed: ccxtMarketInfo.info.quoteOrderQtyMarketAllowed,
                        isSpotTradingAllowed: ccxtMarketInfo.info.isSpotTradingAllowed,
                        isMarginTradingAllowed: ccxtMarketInfo.info.isMarginTradingAllowed,
                        filters: ccxtMarketInfo.info.filters,
                    };
                    if (isMounted.current) setSelectedMarketRules(parsedRules);
                } else {
                    throw new Error(rulesData.message || "Error al parsear las reglas del mercado.");
                }
            } catch (error: any) {
                 if (isMounted.current) {
                    setRulesError(error.message);
                    toast({ title: "Error al Cargar Reglas del Mercado", description: error.message, variant: "destructive" });
                }
            } finally {
                if (isMounted.current) {
                    setRulesLoading(false);
                }
            }
        };

        fetchInitialData();
    }, [selectedMarket?.symbol, toast, annotateMarketPriceHistory]);


    // ======================================================================================================
    // Efecto para iniciar/detener el bot
    // ======================================================================================================
    useEffect(() => {
        if (isBotRunning && isDataLoaded) {
            botIntervalRef.current = setInterval(executeBotStrategy, botIntervalMs);
            executeBotStrategy(); 
        } else {
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current);
                botIntervalRef.current = null;
            }
        }

        return () => {
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current);
            }
        };
    }, [isBotRunning, isDataLoaded, executeBotStrategy, botIntervalMs]);

    return {
        isBotRunning, toggleBotStatus, botOpenPosition, botLastActionTimestamp,
        isPlacingOrder, placeOrderError, selectedMarketRules, rulesLoading, rulesError,
        currentPrice, currentMarketPriceHistory, signalCounts,
    };
};
