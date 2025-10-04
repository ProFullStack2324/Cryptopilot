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
        log(`[useTradingBot - Annotate] Iniciando anotación de ${klines.length} klines.`);
        if (!klines || klines.length === 0) {
            log(`[useTradingBot - Annotate] Klines vacíos o nulos, no se puede anotar.`);
            return [];
        }

        const annotatedHistory: MarketPriceDataPoint[] = [];

        // Iterar sobre cada kline para construir el historial anotado
        for (let i = 0; i < klines.length; i++) {
            const klineItem = klines[i];

            // Validar la kline actual antes de procesarla
            if (!isValidNumber(klineItem[0]) || !isValidNumber(klineItem[1]) || !isValidNumber(klineItem[2]) || !isValidNumber(klineItem[3]) || !isValidNumber(klineItem[4]) || !isValidNumber(klineItem[5])) {
                log(`[useTradingBot - Annotate] Kline inválido en el índice ${i}, saltando.`, klineItem);
                continue; // Saltar esta kline si los valores esenciales son inválidos
            }

            const currentKlineDataPoint: MarketPriceDataPoint = {
                timestamp: klineItem[0] as number,
                openPrice: klineItem[1] as number,
                highPrice: klineItem[2] as number,
                lowPrice: klineItem[3] as number,
                closePrice: klineItem[4] as number,
                volume: klineItem[5] as number,
            };

            // Extraer los precios de cierre hasta el punto actual (inclusive)
            // Esto es crucial porque las funciones de indicadores en indicators.ts operan sobre un array de precios
            const closesUpToCurrent: number[] = klines.slice(0, i + 1).map(k => k[4] as number);

            // Calcular indicadores para el punto actual usando las funciones existentes de indicators.ts
            // Estas funciones devuelven valores únicos, que se asignan directamente.

            // SMA
            // Asegurarse de tener suficientes datos para el período más grande (SMA50)
            if (closesUpToCurrent.length >= 50) { 
                currentKlineDataPoint.sma10 = calculateSMA(closesUpToCurrent, 10);
                currentKlineDataPoint.sma20 = calculateSMA(closesUpToCurrent, 20);
                currentKlineDataPoint.sma50 = calculateSMA(closesUpToCurrent, 50);
            }

            // RSI
            // Necesita al menos `period + 1` precios. Periodo es 14, así que necesita 15.
            if (closesUpToCurrent.length >= 15) { 
                currentKlineDataPoint.rsi = calculateRSI(closesUpToCurrent, 14);
            }

            // MACD
            // calculateMACD en indicators.ts ya maneja sus propios requisitos de longitud de historial internamente.
            // Necesita al menos `slowPeriod + signalPeriod - 1` = 26 + 9 - 1 = 34 precios para empezar a dar resultados significativos.
            // Usaremos un umbral de 50 para ser seguros y consistentes con otros indicadores complejos.
            if (closesUpToCurrent.length >= 50) { 
                const macdResult = calculateMACD(closesUpToCurrent, 12, 26, 9);
                currentKlineDataPoint.macdLine = isValidNumber(macdResult.macdLine) ? macdResult.macdLine : undefined;
                currentKlineDataPoint.signalLine = isValidNumber(macdResult.signalLine) ? macdResult.signalLine : undefined;
                currentKlineDataPoint.macdHistogram = isValidNumber(macdResult.macdHistogram) ? macdResult.macdHistogram : undefined;
            }

            // Bollinger Bands
            // Necesita al menos `period` precios. Periodo es 20.
            if (closesUpToCurrent.length >= 20) {
                const bbResult = calculateBollingerBands(closesUpToCurrent, 20, 2);
                currentKlineDataPoint.upperBollingerBand = isValidNumber(bbResult.upperBollingerBand) ? bbResult.upperBollingerBand : undefined;
                currentKlineDataPoint.middleBollingerBand = isValidNumber(bbResult.middleBollingerBand) ? bbResult.middleBollingerBand : undefined;
                currentKlineDataPoint.lowerBollingerBand = isValidNumber(bbResult.lowerBollingerBand) ? bbResult.lowerBollingerBand : undefined;
            }

            annotatedHistory.push(currentKlineDataPoint);
        }

        log(`[useTradingBot - Annotate] Historial anotado completado. Longitud final: ${annotatedHistory.length}. Última vela:`, annotatedHistory.at(-1));
        return annotatedHistory;
    }, [log]); 

    // ======================================================================================================
    // fetchRealTimeKlinesCallback Refactorizada para usar `annotateMarketPriceHistory`
    // ======================================================================================================
    const fetchRealTimeKlinesCallback = useCallback(async () => {
        if (!isMounted.current) {
            console.warn("WARN: [Realtime Klines] Componente desmontado, saltando fetching de klines.");
            return;
        }

        if (!selectedMarket?.symbol || !selectedMarketRules) {
            console.log("[useTradingBot - Realtime Klines] No market or rules, stopping real-time fetches.");
            return;
        }

        const abortController = new AbortController();
        const signal = abortController.signal;

        try {
            if (signal.aborted) {
                console.log("[useTradingBot - Realtime Klines] Solicitud cancelada (pre-fetch).");
                return;
            }

            const response = await fetch(
                `/api/binance/klines?symbol=${selectedMarket.symbol}&interval=1m&limit=1`,
                { signal } 
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            
            const data: ApiResult<KLine[]> = await response.json(); // Usar KLine aquí
            log("LOG: [useTradingBot - Realtime Klines] Raw KLines data received:", data);

            if (signal.aborted) {
                console.log("[useTradingBot - Realtime Klines] Solicitud cancelada (post-fetch).");
                return;
            }

            const klinesArray = data.data || (data as any).klines; 

            if (data.success && Array.isArray(klinesArray) && klinesArray.length > 0) {
                const newRawKline = klinesArray[0];

                setCurrentMarketPriceHistory(prevHistory => {
                    // Convertir prevHistory (MarketPriceDataPoint[]) a KLine[] para poder manipularlo como un array de raw klines
                    // Esto es necesario porque annotateMarketPriceHistory espera KLine[]
                    const rawKlinesFromHistory: KLine[] = prevHistory.map(dp => [
                        dp.timestamp, dp.openPrice, dp.highPrice, dp.lowPrice, dp.closePrice, dp.volume, 0, 0, 0, 0, 0, 0 // Asegurar que el formato sea KLine
                    ]);
                    const lastKlineInHistory = rawKlinesFromHistory.at(-1);

                    let tempRawHistory: KLine[];

                    // Si la última vela en el historial tiene el mismo timestamp que la nueva, se actualiza.
                    if (lastKlineInHistory && lastKlineInHistory[0] === newRawKline[0]) {
                        tempRawHistory = [...rawKlinesFromHistory.slice(0, -1), newRawKline];
                        log(`[Realtime Klines] Vela existente actualizada: ${new Date(newRawKline[0] as number).toLocaleTimeString()}`);
                    } else {
                        // Si es una nueva vela, se añade y se mantiene el límite de historial.
                        tempRawHistory = [...rawKlinesFromHistory, newRawKline];
                        if (tempRawHistory.length > PRICE_HISTORY_POINTS_TO_KEEP) {
                            tempRawHistory.shift(); 
                            log(`[Realtime Klines] Historial de velas: eliminada vela antigua. Nuevo tamaño: ${tempRawHistory.length}`);
                        }
                        log(`[Realtime Klines] Nueva vela añadida: ${new Date(newRawKline[0] as number).toLocaleTimeString()}. Nuevo tamaño: ${tempRawHistory.length}`);
                    }

                    // Anotar el historial completo con los indicadores
                    const annotatedResult = annotateMarketPriceHistory(tempRawHistory);
                    
                    if (annotatedResult.length > 0) {
                        const latestAnnotated = annotatedResult.at(-1)!;
                        setCurrentPrice(latestAnnotated.closePrice); 
                        log(`[Realtime Klines] Indicadores de la última vela recalculados. (RSI: ${latestAnnotated.rsi?.toFixed(2) || 'N/A'})`);
                        return annotatedResult; 
                    } else {
                        log(`[Realtime Klines] Fallo al anotar el historial de klines en tiempo real.`, { newRawKline });
                        return prevHistory; // Mantener el historial anterior si la anotación falla
                    }
                });
                
            } else {
                console.warn("WARN: [Realtime Klines] Respuesta de klines exitosa pero sin datos de velas. Data:", data);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log("[useTradingBot - Realtime Klines] Fetch de klines en tiempo real abortado (por cleanup).");
                return;
            }
            console.error("ERROR: [useTradingBot - Realtime Klines] Error en fetchRealTimeKlines:", error);
            if (isMounted.current) { 
                toast({
                    title: "Error de conexión",
                    description: "No se pudieron obtener datos de mercado en tiempo real.",
                    variant: "destructive",
                });
            }
        }
    }, [selectedMarket, selectedMarketRules, isMounted, toast, log, annotateMarketPriceHistory]); 

    // ======================================================================================================
    // Lógica principal de la estrategia del bot (AHORA CON MONITOREO DE SL/TP)
    // ======================================================================================================
    const executeBotStrategy = useCallback(async () => {
        const minDataPointsForStrategy = 51; 

        console.groupCollapsed(`LOG: [Bot Cycle] Ejecutando estrategia para ${selectedMarket?.symbol || 'N/A'} @ ${new Date().toLocaleTimeString()} (Velas: ${currentMarketPriceHistory.length})`);
        
        console.log("LOG: [Bot Cycle] Estado de las guardas de ejecución:");
        console.log(`- isBotRunning: ${isBotRunning}`);
        console.log(`- selectedMarket: ${!!selectedMarket}`);
        console.log(`- currentPrice: ${currentPrice}`);
        console.log(`- historyLength (${currentMarketPriceHistory.length}) >= minDataPointsForStrategy (${minDataPointsForStrategy}): ${currentMarketPriceHistory.length >= minDataPointsForStrategy}`);
        console.log(`- selectedMarketRules: ${!!selectedMarketRules}`);
        console.log(`- isPlacingOrder: ${isPlacingOrder}`);
        
        if (!isBotRunning || !selectedMarket || currentPrice === null || currentMarketPriceHistory.length < minDataPointsForStrategy || !selectedMarketRules || isPlacingOrder) {
            console.warn("[Bot Cycle] Bot NO está listo para ejecutar la estrategia principal. Razones:");
            if (!isBotRunning) console.warn("   - El bot no está en estado 'Running'.");
            if (!selectedMarket) console.warn("   - No se ha seleccionado un mercado.");
            if (currentPrice === null) console.warn("   - Precio actual es null.");
            if (currentMarketPriceHistory.length < minDataPointsForStrategy) console.warn(`   - Insuficientes velas históricas (actual: ${currentMarketPriceHistory.length}, requerido: ${minDataPointsForStrategy}).`);
            if (!selectedMarketRules) console.warn("   - Reglas del mercado no cargadas.");
            if (isPlacingOrder) console.warn("   - Ya hay una orden en proceso de colocación.");
            console.groupEnd(); 
            return; 
        }

        console.log(`[Bot Cycle] Todas las condiciones iniciales CUMPLIDAS para ${selectedMarket.symbol}.`);
        console.log(`[Bot Cycle] Precio actual (última vela cerrada): ${currentPrice?.toFixed(selectedMarket.pricePrecision || 2)} ${selectedMarket.quoteAsset}`);

        let actionToExecute: 'buy' | 'sell' | 'hold' = 'hold';
        let orderDataToExecute: OrderFormData | undefined;

        // --- Monitoreo de Stop Loss y Take Profit (Si hay una posición abierta) ---
        if (botOpenPosition) {
            console.log("[Bot Cycle] Detectada posición abierta. Evaluando SL/TP...");
            const { amount, stopLossPrice, takeProfitPrice, entryPrice } = botOpenPosition;

            console.log(`LOG: [Bot Open Position] Tipo: ${botOpenPosition.type.toUpperCase()}, Entrada: ${entryPrice.toFixed(selectedMarket.pricePrecision || 2)}, Cantidad: ${amount.toFixed(selectedMarket.precision.amount || 2)}`);
            console.log(`LOG: [Bot Open Position] SL: ${stopLossPrice?.toFixed(selectedMarket.pricePrecision || 2) || 'N/A'}, TP: ${takeProfitPrice?.toFixed(selectedMarket.pricePrecision || 2) || 'N/A'}`);

            if (stopLossPrice && currentPrice <= stopLossPrice) {
                actionToExecute = 'sell';
                orderDataToExecute = {
                    symbol: selectedMarket.symbol,
                    side: 'SELL',
                    orderType: 'MARKET', 
                    quantity: amount,
                    price: currentPrice, 
                };
                console.warn(`[Bot Action] ¡STOP LOSS ALCANZADO! Precio actual (${currentPrice.toFixed(selectedMarket.pricePrecision || 2)}) <= SL (${stopLossPrice.toFixed(selectedMarket.pricePrecision || 2)}). Preparando VENTA.`);
                toast({
                    title: "¡Stop Loss Activado!",
                    description: `El bot vendió ${amount.toFixed(selectedMarket.precision.amount || 2)} ${selectedMarket.baseAsset} a ${currentPrice.toFixed(selectedMarket.pricePrecision || 2)} ${selectedMarket.quoteAsset}.`,
                    variant: "destructive",
                });
            }
            else if (takeProfitPrice && currentPrice >= takeProfitPrice) {
                actionToExecute = 'sell';
                orderDataToExecute = {
                    symbol: selectedMarket.symbol,
                    side: 'SELL',
                    orderType: 'MARKET',
                    quantity: amount,
                    price: currentPrice, 
                };
                console.log(`[Bot Action] ¡TAKE PROFIT ALCANZADO! Precio actual (${currentPrice.toFixed(selectedMarket.pricePrecision || 2)}) >= TP (${takeProfitPrice.toFixed(selectedMarket.pricePrecision || 2)}). Preparando VENTA.`);
                toast({
                    title: "¡Take Profit Activado!",
                    description: `El bot vendió ${amount.toFixed(selectedMarket.precision.amount || 2)} ${selectedMarket.baseAsset} a ${currentPrice.toFixed(selectedMarket.pricePrecision || 2)} ${selectedMarket.quoteAsset}.`,
                    variant: "default",
                });
            } else {
                console.log("[Bot Cycle] Posición abierta, pero ni SL ni TP activados. Manteniendo posición.");
                actionToExecute = 'hold'; 
            }
        }

        // Si no se activó SL/TP (o no hay posición abierta), pedir a la estrategia la decisión de entrada/salida
        if (actionToExecute === 'hold') { 
            console.log("[Bot Cycle] No hay SL/TP activos o posición. Consultando la estrategia de trading (decideTradeActionAndAmount)...");
            
            const strategyDecision = decideTradeActionAndAmount({
                selectedMarket,
                currentMarketPriceHistory, 
                currentPrice,
                allBinanceBalances,
                botOpenPosition, 
                selectedMarketRules,
                logStrategyMessage: (msg: string, details?: any) => console.log(`[Strategy Output - decideTradeActionAndAmount] ${msg}`, details || '')
            });
            
            actionToExecute = strategyDecision.action;
            orderDataToExecute = strategyDecision.orderData;
            
            console.log(`LOG: [Bot Cycle] 'decideTradeActionAndAmount' decidió: { action: "${actionToExecute.toUpperCase()}", orderData: ${orderDataToExecute ? JSON.stringify(orderDataToExecute) : 'undefined'} }`);
        }

        // --- Colocación de Orden a través de Endpoint de API ---
        if (actionToExecute !== 'hold' && orderDataToExecute) {
            console.log(`[Bot Cycle] Decisión final: ${actionToExecute.toUpperCase()}. Evaluando condiciones para colocar orden...`);
            console.log(`[Bot Cycle] Detalles de la orden propuesta:`, orderDataToExecute);

            if (isPlacingOrder) {
                console.warn("[Bot Cycle] YA HAY UNA ORDEN EN PROCESO. Saltando la colocación de esta orden para evitar duplicados.");
                setPlaceOrderError("Ya hay una orden en proceso. Por favor, espera.");
                if (onBotAction) {
                    onBotAction({
                        type: 'strategyExecuted',
                        success: false, 
                        timestamp: Date.now(),
                        data: { action: 'hold' }, 
                        message: `Decisión de Estrategia: ${actionToExecute.toUpperCase()} - Orden no enviada (otra en proceso).`
                    });
                }
                console.groupEnd(); 
                return; 
            }

            setIsPlacingOrder(true); 
            setPlaceOrderError(null); 

            try {
                const endpoint = '/api/binance/trade';
                console.log(`LOG: [API Call] Bot llamando al endpoint de trade: ${endpoint} con body:`, JSON.stringify(orderDataToExecute, null, 2));

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderDataToExecute),
                });

                const tradeResult: TradeEndpointResponse = await response.json();
                if (!response.ok || !tradeResult.success) {
                    const errorMessage = tradeResult.error || tradeResult.message || "Error desconocido al colocar la orden.";
                    console.error(`ERROR: [API Response] Fallo al colocar la orden: ${errorMessage}`, tradeResult.details);
                    setPlaceOrderError(errorMessage);
                    toast({
                        title: "Error al colocar orden del bot",
                        description: errorMessage,
                        variant: "destructive",
                    });

                    if (onBotAction) {
                        onBotAction({ 
                            type: 'orderPlaced', 
                            success: false, 
                            timestamp: Date.now(),
                            details: tradeResult, 
                            data: { action: actionToExecute as 'buy' | 'sell' } 
                        });

                    }
                } else {
                    const orderDetails: BinanceOrderResult = tradeResult.data!;
                    console.log(`LOG: [API Response] Orden colocada con éxito. Order ID: ${orderDetails?.orderId}`, orderDetails);
                    setBotLastActionTimestamp(Date.now());
                    
                    if (onBotAction) {
                        onBotAction({ 
                            type: 'orderPlaced', 
                            success: true, 
                            timestamp: Date.now(),
                            details: tradeResult, 
                            data: { action: actionToExecute as 'buy' | 'sell' } 
                        });
                    }

                    if (actionToExecute === 'buy') {
                        if (orderDetails?.executedQty && orderDetails?.cummulativeQuoteQty && orderDetails?.transactTime) {
                            const executedQtyNum = parseFloat(orderDetails.executedQty);
                            const cummulativeQuoteQtyNum = parseFloat(orderDetails.cummulativeQuoteQty);
                            const entryPrice = executedQtyNum > 0 ? cummulativeQuoteQtyNum / executedQtyNum : 0;
                            const executedAmount = executedQtyNum;

                            // Definir Stop Loss y Take Profit porcentual
                            const stopLossPrice = entryPrice * (1 - 0.02); // 2% de pérdida
                            const takeProfitPrice = entryPrice * (1 + 0.04); // 4% de ganancia

                            setBotOpenPosition({
                                marketId: selectedMarket.id,
                                entryPrice: parseFloat(entryPrice.toFixed(selectedMarket.pricePrecision || 2)),
                                amount: parseFloat(executedAmount.toFixed(selectedMarket.precision.amount || 2)),
                                type: 'buy',
                                timestamp: Math.floor(orderDetails.transactTime),
                                stopLossPrice: parseFloat(stopLossPrice.toFixed(selectedMarket.pricePrecision || 2)),
                                takeProfitPrice: parseFloat(takeProfitPrice.toFixed(selectedMarket.pricePrecision || 2)),
                            });
                            toast({
                                title: "¡Orden de Compra Exitosa!",
                                description: `El bot compró ${executedAmount.toFixed(selectedMarket.precision.amount || 2)} ${selectedMarket.baseAsset} @ ${entryPrice.toFixed(selectedMarket.pricePrecision || 2)} ${selectedMarket.quoteAsset}. SL: ${stopLossPrice.toFixed(selectedMarket.pricePrecision || 2)}, TP: ${takeProfitPrice.toFixed(selectedMarket.pricePrecision || 2)}.`,
                                variant: "default",
                            });
                            setSignalCounts(prev => ({ ...prev, buy: prev.buy + 1 }));

                        } else {
                            console.warn("[useTradingBot] Detalles de orden de compra incompletos para actualizar la posición. OrderResult:", orderDetails);
                            toast({
                                title: "Orden de Compra Exitosa (parcial)",
                                description: "La orden se colocó pero los detalles de actualización de posición fueron incompletos.",
                                variant: "default",
                            });
                        }
                    } else if (actionToExecute === 'sell') {
                        setBotOpenPosition(null); // Borrar la posición abierta al vender
                        toast({
                            title: "¡Orden de Venta Exitosa!",
                            description: `El bot vendió la posición de ${botOpenPosition?.amount.toFixed(selectedMarket.precision.amount || 2)} ${selectedMarket.baseAsset} @ ${currentPrice?.toFixed(selectedMarket.pricePrecision || 2)} ${selectedMarket.quoteAsset}.`,
                            variant: "default",
                        });
                        setSignalCounts(prev => ({ ...prev, sell: prev.sell + 1 }));
                    }
                }
            } catch (fetchError: any) {
                console.error("[useTradingBot] Error de red o en la respuesta de la API (fetch catch):", fetchError);
                const errorMessage = fetchError.message || "Error de conexión con la API de Binance.";
                setPlaceOrderError(errorMessage);
                toast({
                    title: "Error de conexión",
                    description: errorMessage,
                    variant: "destructive",
                });

                if (onBotAction) {
                    onBotAction({ 
                        type: 'orderPlaced', 
                        success: false, 
                        timestamp: Date.now(),
                        details: { error: errorMessage }, 
                        data: { action: actionToExecute as 'buy' | 'sell' } 
                    });
                }         
            } finally {
                setIsPlacingOrder(false); // Siempre resetea isPlacingOrder
            }
        } else {
            console.log(`[Bot Cycle] No se decidió acción para ejecutar (${actionToExecute}) o orderDataToExecute es undefined. Saltando colocación de orden.`);
            if (onBotAction) {
                onBotAction({
                    type: 'strategyExecuted',
                    success: true, 
                    timestamp: Date.now(),
                    data: { action: 'hold' }, 
                    message: `Decisión de Estrategia: HOLD (No se tomó acción de trading en este ciclo).`
                });
            }
            setSignalCounts(prev => ({ ...prev, hold: prev.hold + 1 }));
        }
        console.groupEnd(); 
    }, [
        isBotRunning,
        selectedMarket,
        currentMarketPriceHistory,
        currentPrice,
        allBinanceBalances,
        botOpenPosition,
        selectedMarketRules,
        isPlacingOrder,
        toast,
        onBotAction,
        log,
        setBotOpenPosition,
        setBotLastActionTimestamp,
        setPlaceOrderError,
        setIsPlacingOrder,
        setSignalCounts,
    ]);

    // ======================================================================================================
    // Efecto para gestionar la bandera isMounted.
    // ======================================================================================================
    useEffect(() => {
        isMounted.current = true; 
        console.log("LOG: [useTradingBot - Lifecycle] Componente montado. isMounted = true.");
        return () => {
            isMounted.current = false; 
            console.log("LOG: [useTradingBot - Lifecycle] Componente desmontándose. isMounted = false.");
        };
    }, []);

    const toggleBotStatus = useCallback(() => {
        setIsBotRunning(prev => {
            const nextState = !prev;
            // Usar un efecto para el toast para evitar el error de renderizado
            if (selectedMarket) {
                // Este setTimeout(..., 0) soluciona el error "Cannot update a component while rendering a different component"
                setTimeout(() => {
                    toast({
                        title: `Bot ${nextState ? 'iniciado' : 'detenido'}`,
                        description: `El bot de trading para ${selectedMarket.symbol} ha sido ${nextState ? 'iniciado' : 'detenido'}.`,
                        variant: nextState ? 'default' : 'destructive',
                    });
                }, 0);
            }
            return nextState;
        });
    }, [selectedMarket, toast]);
    
    // ======================================================================================================
    // Efecto para la Carga Inicial de Reglas del Mercado y el Historial de Velas (OHLCV).
    // ======================================================================================================
    useEffect(() => {
        if (botIntervalRef.current) {
            clearInterval(botIntervalRef.current);
            botIntervalRef.current = null;
            console.log("[useTradingBot] Limpiando intervalo anterior de estrategia.");
        }
        if (priceFetchIntervalRef.current) {
            clearInterval(priceFetchIntervalRef.current);
            priceFetchIntervalRef.current = null;
            console.log("[useTradingBot] Limpiando intervalo anterior de fetching de precios.");
        }

        const fetchMarketRulesAndKlines = async () => {
            console.groupCollapsed(`LOG: [useTradingBot - Init] Iniciando la carga de datos fundamentales para ${selectedMarket?.symbol || 'N/A'}`);
            if (!selectedMarket?.symbol) {
                console.log("[useTradingBot] Ausencia de mercado seleccionado para la carga de reglas. La inicialización se detiene.");
                if (isMounted.current) {
                    setSelectedMarketRules(null);
                    setRulesLoading(false);
                    setCurrentMarketPriceHistory([]); 
                    setCurrentPrice(null);
                    setIsDataLoaded(false); 
                } else {
                    console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se actualiza el estado por falta de mercado.");
                }
                console.groupEnd();
                return;
            }

            if (isDataLoaded && selectedMarketRules?.symbol === selectedMarket.symbol && currentMarketPriceHistory.length > 0) {
                console.log(`LOG: [useTradingBot - Init] Los datos fundamentales para ${selectedMarket.symbol} ya han sido cargados y se encuentran en estado estable. Se omite la recarga.`);
                console.groupEnd();
                return;
            }

            if (isMounted.current) {
                setRulesLoading(true);
                setRulesError(null); 
                setIsDataLoaded(false); 
            } else {
                console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se resetea el estado de carga inicial.");
                console.groupEnd();
                return;
            }
            
            console.log(`LOG: [useTradingBot - Init] Iniciando el proceso de adquisición de reglas y series de velas para ${selectedMarket.symbol}...`);
            try {
                console.log(`LOG: [useTradingBot - Init] Fetching exchange-info for ${selectedMarket.symbol}`);
                const rulesResponse = await fetch(`/api/binance/exchange-info?symbol=${selectedMarket.symbol}`);
                if (!rulesResponse.ok) {
                    const errorData = await rulesResponse.json(); 
                    console.error(`ERROR: [useTradingBot - Init] Fallo HTTP en la carga de reglas: ${rulesResponse.status}`, errorData);
                    throw new Error(errorData.message || `Error HTTP ${rulesResponse.status}`);
                }
                const rulesData: ApiResult<any> = await rulesResponse.json(); 
                console.log(`LOG: [useTradingBot - Init] Raw rulesData received:`, rulesData);
                
                if (rulesData.success && rulesData.data) { 
                    const ccxtMarketInfo = rulesData.data;

                    const parseMarketRules = (marketInfo: any): MarketRules => {
                        const lotSizeFilter = marketInfo.info.filters.find((f: any) => f.filterType === 'LOT_SIZE');
                        const minNotionalFilter = marketInfo.info.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
                        const priceFilter = marketInfo.info.filters.find((f: any) => f.filterType === 'PRICE_FILTER');

                        return {
                            symbol: marketInfo.symbol,
                            status: marketInfo.active ? 'TRADING' : 'BREAK', 
                            baseAsset: marketInfo.base,
                            quoteAsset: marketInfo.quote,
                            baseAssetPrecision: marketInfo.precision.base,
                            quotePrecision: marketInfo.precision.quote,
                            icebergAllowed: marketInfo.info.icebergAllowed,
                            ocoAllowed: marketInfo.info.ocoAllowed,
                            quoteOrderQtyMarketAllowed: marketInfo.info.quoteOrderQtyMarketAllowed,
                            isSpotTradingAllowed: marketInfo.info.isSpotTradingAllowed,
                            isMarginTradingAllowed: marketInfo.info.isMarginTradingAllowed,
                            filters: marketInfo.info.filters, 
                            lotSize: {
                                minQty: parseFloat(lotSizeFilter?.minQty || '0'),
                                maxQty: parseFloat(lotSizeFilter?.maxQty || '0'),
                                stepSize: parseFloat(lotSizeFilter?.stepSize || '0'),
                            },
                            minNotional: { 
                                minNotional: parseFloat(minNotionalFilter?.minNotional || '0'), 
                            },
                            priceFilter: {
                                minPrice: parseFloat(priceFilter?.minPrice || '0'),
                                maxPrice: parseFloat(priceFilter?.maxPrice || '0'),
                                tickSize: parseFloat(priceFilter?.tickSize || '0'),
                            },
                            precision: {
                                price: marketInfo.precision.price,
                                amount: marketInfo.precision.amount,
                                base: marketInfo.precision.base, 
                                quote: marketInfo.precision.quote 
                            }
                        };
                    };
                    
                    const parsedRules: MarketRules = parseMarketRules(ccxtMarketInfo);
                    
                    if (isMounted.current) {
                        setSelectedMarketRules(parsedRules);
                        console.log(`LOG: [useTradingBot - Init] Parsed MarketRules:`, parsedRules);
                    } else {
                        console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se actualizan las reglas de mercado.");
                    }
                                        
                    console.log(`LOG: [useTradingBot - Init] Fetching klines for ${selectedMarket.symbol}`);
                    const klinesResponse = await fetch(`/api/binance/klines?symbol=${selectedMarket.symbol}&interval=1m&limit=${PRICE_HISTORY_POINTS_TO_KEEP}`);
                    
                    if (!klinesResponse.ok) {
                        const errorData = await klinesResponse.json();
                        console.error(`ERROR: [useTradingBot - Init] Fallo HTTP en la carga de klines: ${klinesResponse.status}`, errorData);
                        throw new Error(errorData.message || `Error HTTP ${klinesResponse.status}`);
                    }
                    const klinesData: ApiResult<KLine[]> = await klinesResponse.json(); // Usar KLine aquí
                    console.log("LOG: [useTradingBot - Init] Raw KLines data received:", klinesData);

                    const klinesArray = klinesData.data || (klinesData as any).klines; 
                    if (klinesData.success && Array.isArray(klinesArray) && klinesArray.length > 0) {
                        console.log("LOG: [useTradingBot - Init] Klines encontrados en 'data' o 'klines' propiedad.");

                        // Aquí se anota el historial completo con los indicadores
                        const historyWithIndicators = annotateMarketPriceHistory(klinesArray);
                        
                        if (isMounted.current) { 
                            setCurrentMarketPriceHistory(historyWithIndicators);
                            // Tomar el closePrice de la última vela anotada como el precio actual
                            setCurrentPrice(historyWithIndicators[historyWithIndicators.length - 1]?.closePrice || null); 
                            console.log(`LOG: [useTradingBot - Init] La serie histórica inicial de ${historyWithIndicators.length} velas reales ha sido cargada con éxito.`);
                            setIsDataLoaded(true); 
                            console.log(`[useTradingBot - Init] La carga fundamental de reglas y velas ha concluido.`);
                        } else {
                            console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se actualizan historial/precio inicial.");
                        }

                    } else {
                        console.warn("[useTradingBot - Init] No fue posible obtener una serie histórica de velas válida o esta se encuentra vacía. Detalles:", klinesData);
                        if (isMounted.current) { 
                            setCurrentMarketPriceHistory([]);
                            setCurrentPrice(null);
                            setRulesError("No se pudieron cargar velas históricas iniciales. Verifique la validez del símbolo y la disponibilidad de datos."); 
                            setIsDataLoaded(false); 
                        } else {
                            console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se actualiza estado por fallo de klines.");
                        }
                    }
                } else {
                    const errorMessage = rulesData.message || "Error desconocido al cargar reglas del mercado desde exchange-info.";
                    console.error("ERROR: [useTradingBot - Init] Error en la carga de reglas:", errorMessage, rulesData);
                    if (isMounted.current) { 
                        setRulesError(errorMessage);
                        setIsDataLoaded(false); 
                    }
                    throw new Error(errorMessage); 
                }
            } catch (error: any) {
                console.error("ERROR: [useTradingBot - Init] Falencia crítica en el proceso de carga inicial (reglas/velas):", error);
                const errorMessage = error.message || "Error desconocido durante el proceso de carga fundamental de datos.";
                if (isMounted.current) { 
                    setRulesError(errorMessage);
                    setIsDataLoaded(false); 
                    setCurrentPrice(null);
                    setCurrentMarketPriceHistory([]);
                    toast({
                        title: "Error al cargar datos de mercado",
                        description: errorMessage,
                        variant: "destructive",
                    });
                } else {
                    console.warn("WARN: [useTradingBot - Init] Componente desmontado, no se actualiza estado en catch de carga inicial.");
                }
            } finally {
                if (isMounted.current) { 
                    setRulesLoading(false);
                    console.log("[useTradingBot - Init] Carga inicial de reglas y velas finalizada.");
                    console.groupEnd();
                } else {
                    console.log("LOG: [useTradingBot - Init] finally: Componente desmontado, no se actualiza rulesLoading.");
                }
            }
        };

        fetchMarketRulesAndKlines();
        
        return () => {
            if (priceFetchIntervalRef.current) {
                clearInterval(priceFetchIntervalRef.current);
                priceFetchIntervalRef.current = null;
                console.log("LOG: [useTradingBot - Init Cleanup] Intervalo de fetching de precios limpiado.");
            }
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current);
                botIntervalRef.current = null;
                console.log("LOG: [useTradingBot - Init Cleanup] Intervalo de estrategia limpiado.");
            }
        };
    }, [selectedMarket?.symbol, toast, log, isMounted, setSelectedMarketRules, setRulesLoading, setCurrentMarketPriceHistory, setCurrentPrice, setIsDataLoaded, setRulesError, annotateMarketPriceHistory]); 

    // ======================================================================================================
    // Efecto para OBTENER LA ÚLTIMA VELA (O EL PRECIO ACTUAL SI NO HAY NUEVA VELA) y mantener el historial
    // ======================================================================================================
    useEffect(() => {
        if (!selectedMarket?.symbol || !selectedMarketRules) {
            if (priceFetchIntervalRef.current) {
                clearInterval(priceFetchIntervalRef.current);
                priceFetchIntervalRef.current = null;
            }
            console.log("[useTradingBot - Realtime Klines] No market or rules, stopping real-time fetches.");
            return;
        }

        fetchRealTimeKlinesCallback(); 

        if (priceFetchIntervalRef.current) {
            clearInterval(priceFetchIntervalRef.current);
        }
        priceFetchIntervalRef.current = setInterval(fetchRealTimeKlinesCallback, 1000); 

        return () => {
            if (priceFetchIntervalRef.current) {
                clearInterval(priceFetchIntervalRef.current);
                priceFetchIntervalRef.current = null; // Corrected from botIntervalRef.current = null;
            }
            console.log("LOG: [useTradingBot - Realtime Klines Cleanup] Intervalo de klines limpiado.");
        };
    }, [selectedMarket?.symbol, selectedMarketRules, fetchRealTimeKlinesCallback]); 

    // ======================================================================================================
    // Efecto para iniciar/detener el bot
    // ======================================================================================================
    useEffect(() => {
        if (isBotRunning) {
            console.log("LOG: [Bot Control] Bot iniciado. Estableciendo intervalo de estrategia.");
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current); 
            }
            botIntervalRef.current = setInterval(executeBotStrategy, botIntervalMs); // Usar botIntervalMs aquí
            executeBotStrategy(); // Ejecutar inmediatamente al iniciar
        } else {
            console.log("LOG: [Bot Control] Bot detenido. Limpiando intervalo de estrategia.");
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current);
                botIntervalRef.current = null;
            }
        }

        return () => {
            if (botIntervalRef.current) {
                clearInterval(botIntervalRef.current);
                botIntervalRef.current = null;
            }
            console.log("LOG: [Bot Control Cleanup] Intervalo de estrategia limpiado.");
        };
    }, [isBotRunning, executeBotStrategy, botIntervalMs]); // Añadir botIntervalMs como dependencia

    // ======================================================================================================
    // Retorno del Hook
    // ======================================================================================================
    return {
        isBotRunning,
        toggleBotStatus,
        botOpenPosition,
        botLastActionTimestamp,
        isPlacingOrder,
        placeOrderError,
        selectedMarketRules,
        rulesLoading,
        rulesError,
        currentPrice,
        currentMarketPriceHistory,
        signalCounts, 
    };
};
