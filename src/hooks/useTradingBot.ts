// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from './use-toast';

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
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands } from '@/lib/indicators';

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
    const [botIntervalMs] = useState(5000);
    
    const { toast } = useToast();
    const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(false);

    const logAction = useCallback((message: string, success: boolean, type: BotActionDetails['type'], details?: any, data?: any) => {
        onBotAction({ type, success, message, details, data, timestamp: Date.now() });
    }, [onBotAction]);

    const executeOrder = useCallback(async (orderData: Omit<OrderFormData, 'symbol' | 'orderType'> & { side: 'buy' | 'sell'; quantity: number }, strategyForOrder: 'scalping' | 'sniper') => {
        if (isPlacingOrder) return false;
        if (!selectedMarket) {
            logAction("FALLO al colocar orden: No hay mercado seleccionado.", false, 'order_failed');
            return false;
        }
    
        setIsPlacingOrder(true);
        setPlaceOrderError(null);
    
        const finalOrderData = {
            symbol: selectedMarket.symbol,
            type: 'market',
            side: orderData.side,
            amount: orderData.quantity,
            price: orderData.price,
        };
    
        logAction(`Intento de orden (${strategyForOrder}): ${finalOrderData.side} ${finalOrderData.amount} ${finalOrderData.symbol}`, true, 'order_placed', finalOrderData);
    
        try {
            const response = await fetch('/api/binance/trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalOrderData) });
            const result: TradeEndpointResponse = await response.json();
    
            if (!response.ok || !result.success) {
                const errorMessage = result.message || result.details || "Error desconocido al colocar la orden.";
                setPlaceOrderError(errorMessage);
                logAction(`FALLO al colocar orden: ${errorMessage}`, false, 'order_failed', { error: errorMessage, orderData: finalOrderData });
                toast({ title: "Error al colocar orden", description: errorMessage, variant: "destructive" });
                return false;
            } else {
                const config = STRATEGY_CONFIG[strategyForOrder];
                setBotLastActionTimestamp(Date.now());
                if (finalOrderData.side === 'buy' && result.data?.price) {
                    const entryPrice = parseFloat(result.data.price);
                    const takeProfitPrice = entryPrice * (1 + config.takeProfitPercentage);
                    const stopLossPrice = entryPrice * (1 - config.stopLossPercentage);
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
                logAction(`ÉXITO al colocar orden ${finalOrderData.side}`, true, 'order_placed', result.data);
                return true;
            }
        } catch (error: any) {
            const errorMessage = error.message || "Error de conexión con la API.";
            setPlaceOrderError(errorMessage);
            logAction(`FALLO de red al colocar orden: ${errorMessage}`, false, 'order_failed', { error: errorMessage, orderData: finalOrderData });
            toast({ title: "Error de conexión", description: errorMessage, variant: "destructive" });
            return false;
        } finally {
            if (isMounted.current) setIsPlacingOrder(false);
        }
    }, [isPlacingOrder, logAction, toast, selectedMarket]);
    
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
            
            const prevKline = i > 0 ? klines[i - 1] : null;

            const sma10 = calculateSMA(currentCloses, 10);
            const sma20 = calculateSMA(currentCloses, 20);
            const sma50 = calculateSMA(currentCloses, 50);
            const rsi = calculateRSI(currentCloses, 14);
            const macd = calculateMACD(currentCloses, 12, 26, 9);
            const bb = calculateBollingerBands(currentCloses, 20, 2);

            let buyConditionsMet = 0;
            let sellConditionsMet = 0;

            if (isValidNumber(closePrice) && isValidNumber(bb.lower) && closePrice <= bb.lower) buyConditionsMet++;
            if (isValidNumber(rsi) && rsi <= 35) buyConditionsMet++;
            if (isValidNumber(macd.macdHistogram) && prevKline) {
                 const prevMacd = calculateMACD(klines.slice(0, i).map(k => k[4]), 12, 26, 9);
                 if (isValidNumber(prevMacd.macdHistogram) && macd.macdHistogram > 0 && prevMacd.macdHistogram <= 0) {
                     buyConditionsMet++;
                 }
            }
            
            if (isValidNumber(closePrice) && isValidNumber(bb.upper) && closePrice >= bb.upper) sellConditionsMet++;
            if (isValidNumber(rsi) && rsi >= 65) sellConditionsMet++;
            
            annotatedHistory.push({
                timestamp, openPrice, highPrice, lowPrice, closePrice, volume,
                sma10, sma20, sma50, rsi,
                macdLine: macd.macdLine,
                signalLine: macd.signalLine,
                macdHistogram: macd.macdHistogram,
                upperBollingerBand: bb.upper,
                middleBollingerBand: bb.middle,
                lowerBollingerBand: bb.lower,
                buyConditionsMet,
                sellConditionsMet,
            });
        }
        return annotatedHistory;
    }, []);

    const executeBotStrategy = useCallback(async () => {
        if (!isBotRunning || !selectedMarket || currentPrice === null || currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY_FOR_BOT || !selectedMarketRules || isPlacingOrder) {
            return;
        }
    
        const latest = currentMarketPriceHistory.at(-1);
        if (!latest) return;

        if (simulatedPosition) {
            const { takeProfitPrice, stopLossPrice, simulationId, entryPrice, amount } = simulatedPosition;
            let exitReason: string | null = null;
            if (takeProfitPrice && currentPrice >= takeProfitPrice) exitReason = 'take_profit';
            else if (stopLossPrice && currentPrice <= stopLossPrice) exitReason = 'stop_loss';

            if (exitReason) {
                const finalPnl = (currentPrice - entryPrice) * amount;
                logAction(`Simulación finalizada por ${exitReason}. PnL: ${finalPnl.toFixed(2)}.`, true, 'strategy_decision');
                
                if (simulationId) {
                    fetch('/api/simulations/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            simulationId,
                            exitPrice: currentPrice,
                            exitReason,
                            finalPnl,
                        }),
                    }).catch(e => console.error("Failed to save simulation end state", e));
                }
                
                setSimulatedPosition(null);
            }
        }
    
        if (botOpenPosition) {
            const { amount, takeProfitPrice, stopLossPrice, strategy } = botOpenPosition;
            const currentRsi = latest.rsi;
    
            let sellReason: 'take_profit' | 'stop_loss' | 'rsi_sell' | null = null;
    
            if (takeProfitPrice && currentPrice >= takeProfitPrice) {
                sellReason = 'take_profit';
            } else if (stopLossPrice && currentPrice <= stopLossPrice) {
                sellReason = 'stop_loss';
            } else if (isValidNumber(currentRsi) && currentRsi >= STRATEGY_CONFIG.rsiSellThreshold) {
                sellReason = 'rsi_sell';
            }
    
            if (sellReason) {
                logAction(`Señal de VENTA por ${sellReason}.`, true, 'strategy_decision', { reason: sellReason, currentPrice, rsi: currentRsi, target: sellReason === 'take_profit' ? takeProfitPrice : stopLossPrice });
                
                let quantityToSell = amount;
                const stepSize = selectedMarketRules.lotSize.stepSize;
                if (stepSize > 0) {
                    quantityToSell = Math.floor(quantityToSell / stepSize) * stepSize;
                }
                quantityToSell = parseFloat(quantityToSell.toFixed(selectedMarketRules.precision.amount));
    
                if (quantityToSell >= selectedMarketRules.lotSize.minQty) {
                    await executeOrder({ side: 'sell', quantity: quantityToSell, price: currentPrice }, strategy || 'scalping');
                } else {
                    logAction(`FALLO al vender: la cantidad ajustada (${quantityToSell}) es menor que el mínimo permitido.`, false, 'order_failed', { quantityToSell });
                }
                return; 
            }
            logAction(`HOLD: Posición de compra abierta (${botOpenPosition.strategy}). Monitoreando para salida.`, true, 'strategy_decision');
        }
        
        if (!botOpenPosition) {
            const decision = decideTradeActionAndAmount({
                selectedMarket,
                currentMarketPriceHistory,
                currentPrice,
                allBinanceBalances,
                botOpenPosition,
                selectedMarketRules,
                logStrategyMessage: (message, details) => logAction(message, true, 'strategy_decision', details)
            });
            
            if (decision.action !== 'hold') {
                 logAction(`Decisión de la estrategia: ${decision.action.toUpperCase()}${decision.details?.strategyMode ? ` en modo ${decision.details.strategyMode}` : ''}`, true, 'strategy_decision', decision.details, { action: decision.action });
            }
    
            if (decision.action === 'buy' && decision.orderData && decision.details.strategyMode) {
                await executeOrder({ side: 'buy', quantity: decision.orderData.quantity, price: decision.orderData.price }, decision.details.strategyMode);
            } else if (decision.action === 'hold_insufficient_funds' && decision.orderData && decision.details.strategyMode) {
                const config = STRATEGY_CONFIG[decision.details.strategyMode];
                const entryPrice = decision.orderData.price;
                const takeProfitPrice = entryPrice * (1 + config.takeProfitPercentage);
                const stopLossPrice = entryPrice * (1 - config.stopLossPercentage);

                const newSimulation: Omit<BotOpenPosition, 'simulationId'> = {
                    marketId: selectedMarket.id,
                    entryPrice: entryPrice,
                    amount: decision.orderData.quantity,
                    type: 'buy',
                    timestamp: Date.now(),
                    takeProfitPrice,
                    stopLossPrice,
                    strategy: decision.details.strategyMode,
                };

                try {
                    const response = await fetch('/api/simulations/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newSimulation),
                    });
                    const result = await response.json();
                    if(result.success && result.insertedId) {
                        setSimulatedPosition({ ...newSimulation, simulationId: result.insertedId });
                    } else {
                        setSimulatedPosition(newSimulation);
                        console.error("Failed to save simulation start state");
                    }
                } catch (e) {
                     setSimulatedPosition(newSimulation);
                     console.error("Error connecting to simulation save API", e);
                }
            }
        }
    
    }, [ isBotRunning, selectedMarket, currentMarketPriceHistory, currentPrice, allBinanceBalances, botOpenPosition, simulatedPosition, selectedMarketRules, isPlacingOrder, logAction, executeOrder ]);
    
    // Función para generar datos de mercado simulados
    const generateSimulatedData = useCallback(() => {
        setCurrentMarketPriceHistory(prevHistory => {
            const lastPoint = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : { closePrice: 60000, timestamp: Date.now() - 60000 };
            const newPrice = lastPoint.closePrice * (1 + (Math.random() - 0.5) * 0.001); // Fluctuación aleatoria
            const newPoint:KLine = [
                Date.now(),
                lastPoint.closePrice,
                Math.max(lastPoint.closePrice, newPrice),
                Math.min(lastPoint.closePrice, newPrice),
                newPrice,
                Math.random() * 10,
            ];
            
            const newHistoryKlines = [...prevHistory.map(p => [p.timestamp, p.openPrice, p.highPrice, p.lowPrice, p.closePrice, p.volume] as KLine), newPoint];
            if (newHistoryKlines.length > PRICE_HISTORY_POINTS_TO_KEEP) {
                newHistoryKlines.shift();
            }
            
            const annotated = annotateMarketPriceHistory(newHistoryKlines);
            if (annotated.length > 0) {
                 setCurrentPrice(annotated[annotated.length - 1].closePrice);
            }
            return annotated;
        });
    }, [annotateMarketPriceHistory]);


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

        let dataInterval: NodeJS.Timeout | null = null;

        const fetchMarketData = async () => {
            if (!isMounted.current) return;
            setRulesLoading(true);
            setRulesError(null);
            
            try {
                // Fetch Rules
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

                // Fetch Klines
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
                } else {
                    if (isMounted.current) setIsDataLoaded(false);
                }

            } catch (error: any) {
                if (isMounted.current) {
                    setRulesError(error.message);
                    logAction(`Error de Conexión: ${error.message}. Activando modo simulado.`, false, 'order_failed');
                    setIsDataLoaded(true); // Permitir que el bot inicie en modo simulado
                    // Iniciar generación de datos simulados si la carga real falla
                    if (!dataInterval) {
                        generateSimulatedData(); // Carga inicial simulada
                        dataInterval = setInterval(generateSimulatedData, 5000);
                    }
                }
            } finally {
                if (isMounted.current) setRulesLoading(false);
            }
        };

        fetchMarketData(); // Llamada inicial
        const initialDataInterval = setInterval(fetchMarketData, 30000); // Intervalo para datos reales
        
        return () => {
            clearInterval(initialDataInterval);
            if (dataInterval) clearInterval(dataInterval);
        };

    }, [selectedMarket?.symbol, timeframe, annotateMarketPriceHistory, generateSimulatedData, logAction]);

    useEffect(() => {
        if (isBotRunning && isDataLoaded) {
            botIntervalRef.current = setInterval(executeBotStrategy, botIntervalMs);
        } else {
            if (botIntervalRef.current) clearInterval(botIntervalRef.current);
        }
        return () => { if (botIntervalRef.current) clearInterval(botIntervalRef.current); };
    }, [isBotRunning, isDataLoaded, executeBotStrategy, botIntervalMs]);

    return {
        isBotRunning, toggleBotStatus, botOpenPosition, botLastActionTimestamp,
        isPlacingOrder, placeOrderError, selectedMarketRules, rulesLoading, rulesError,
        currentPrice, currentMarketPriceHistory, simulatedPosition
    };
};
