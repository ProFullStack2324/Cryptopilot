
// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Market, MarketPriceDataPoint, OrderFormData, SimulatedPosition } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

interface FormattedBalance {
    available: number;
    onOrder: number;
    total: number;
}

interface UseTradingBotProps {
  selectedMarket: Market | null;
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null;
  allBinanceBalances: Record<string, FormattedBalance> | null;
  botIntervalMs?: number;
  useTestnet?: boolean;
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void;
}

interface UseTradingBotReturn {
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  botOpenPosition: SimulatedPosition | null;
  botLastActionTimestamp: number;
  isPlacingOrder: boolean;
  placeOrderError: any;
  selectedMarketRules: any; // Reglas del mercado cargadas
  marketRulesError: string | null; // Error durante la carga de reglas
}

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  botIntervalMs = 15000,
  useTestnet = false,
  onBotAction,
}: UseTradingBotProps): UseTradingBotReturn => {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<any>(null);
  const [selectedMarketRules, setSelectedMarketRules] = useState<any>(null);
  const [marketRulesError, setMarketRulesError] = useState<string | null>(null); // Nuevo estado para error de reglas

  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

  const networkType = useTestnet ? 'Testnet' : 'Mainnet';

  useEffect(() => {
    console.log(`[useTradingBot - ${networkType}] Hook montado/actualizado. Props:`, { selectedMarket: selectedMarket?.symbol, useTestnet, currentPrice, historyLength: currentMarketPriceHistory.length, balancesLoaded: !!allBinanceBalances });
  }, [selectedMarket, useTestnet, currentPrice, currentMarketPriceHistory.length, allBinanceBalances, networkType]);

  const fetchMarketRules = useCallback(async () => {
    if (!selectedMarket) {
        console.log(`[useTradingBot - ${networkType}] fetchMarketRules: No hay mercado seleccionado. Limpiando reglas.`);
        setSelectedMarketRules(null);
        setMarketRulesError(null); // Limpiar error si no hay mercado
        return;
    }

    console.log(`[useTradingBot - ${networkType}] fetchMarketRules: Intentando obtener reglas para ${selectedMarket.symbol}...`);
    setMarketRulesError(null); // Limpiar error de reglas anterior antes de un nuevo intento

    const endpoint = `/api/binance/exchange-info?symbol=${selectedMarket.symbol}&isTestnet=${useTestnet}`;

    try {
        const response = await fetch(endpoint);
        const data = await response.json();

        console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: HTTP Status for rules: ${response.status}`);
        console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: Raw response data for rules:`, JSON.stringify(data, null, 2)); // Loguear como string para mejor visibilidad

        if (response.ok && data.success && data.data) {
            setSelectedMarketRules(data.data);
            console.log(`[useTradingBot - ${networkType}] Reglas del mercado ${selectedMarket.symbol} almacenadas:`, data.data);
        } else {
            const errorMsg = data.message || `Error HTTP ${response.status} al obtener reglas para ${selectedMarket.symbol}. Respuesta: ${JSON.stringify(data)}`;
            console.error(`[useTradingBot - ${networkType}] Error al cargar reglas: ${errorMsg}`);
            setSelectedMarketRules(null);
            setMarketRulesError(errorMsg);
            toast({
                title: "Error al Cargar Reglas del Mercado",
                description: `No se pudieron obtener las reglas para ${selectedMarket.symbol}. Detalles: ${errorMsg}`,
                variant: "destructive",
            });
        }
    } catch (error: any) {
        const errorMsg = `Error de conexión o al parsear JSON de reglas para ${selectedMarket.symbol}: ${error.message}`;
        console.error(`[useTradingBot - ${networkType}] Fetch error en market rules: ${errorMsg}`, error);
        setSelectedMarketRules(null);
        setMarketRulesError(errorMsg);
        toast({
            title: "Error de Conexión (Reglas Mercado)",
            description: `No se pudo conectar para obtener las reglas del mercado ${selectedMarket.symbol}. Detalles: ${error.message}`,
            variant: "destructive",
        });
    }
  }, [selectedMarket, useTestnet, toast, networkType]); // networkType es constante para el ciclo de vida del callback si useTestnet no cambia

  useEffect(() => {
    if (selectedMarket) {
      fetchMarketRules();
    } else {
      // Si no hay mercado seleccionado, limpiar las reglas y el error de reglas.
      setSelectedMarketRules(null);
      setMarketRulesError(null);
    }
  }, [selectedMarket, fetchMarketRules]);


const executeBotStrategy = useCallback(async () => {
    console.groupCollapsed(`[Bot Strategy - ${networkType}] Ejecución ${new Date().toLocaleTimeString()} para ${selectedMarket?.symbol}`);
    console.log(`[Bot Strategy - ${networkType}] Estado actual: isBotRunning=${isBotRunning}, Mercado=${selectedMarket?.symbol}, Precio=${currentPrice}, Historial=${currentMarketPriceHistory.length}, ReglasCargadas=${!!selectedMarketRules}, ErrorReglas=${marketRulesError}`);

    if (!isBotRunning) {
        console.log(`[Bot Strategy - ${networkType}] Bot no está corriendo. Saliendo.`);
        console.groupEnd();
        return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20 || !selectedMarketRules) {
        console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes para ejecutar la estrategia.`);
        if (!selectedMarket) console.warn(`[Bot Strategy - ${networkType}] Causa: No hay mercado seleccionado.`);
        if (!currentPrice || currentPrice <= 0) console.warn(`[Bot Strategy - ${networkType}] Causa: Precio actual inválido (${currentPrice}).`);
        if (currentMarketPriceHistory.length < 20) console.warn(`[Bot Strategy - ${networkType}] Causa: Historial de precios insuficiente (${currentMarketPriceHistory.length}).`);
        if (!selectedMarketRules) console.warn(`[Bot Strategy - ${networkType}] Causa: Reglas del mercado no cargadas.`);
        if (marketRulesError) console.warn(`[Bot Strategy - ${networkType}] Error previo al cargar reglas: ${marketRulesError}`);
        console.groupEnd();
        return;
    }

    const timeSinceLastAction = Date.now() - botLastActionTimestamp;
    if (timeSinceLastAction < BOT_MIN_ACTION_INTERVAL_MS) {
        console.log(`[Bot Strategy - ${networkType}] Esperando intervalo mínimo entre acciones. Faltan ${BOT_MIN_ACTION_INTERVAL_MS - timeSinceLastAction}ms.`);
        console.groupEnd();
        return;
    }

    console.log(`[Bot Strategy - ${networkType}] Analizando ${selectedMarket.name} a precio: ${currentPrice}. Reglas:`, selectedMarketRules);
    // ... (resto de la lógica de estrategia: SMA, MACD) ...
    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2];

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    if (latestPriceDataPoint.sma10 !== undefined && latestPriceDataPoint.sma20 !== undefined &&
        previousPriceDataPoint.sma10 !== undefined && previousPriceDataPoint.sma20 !== undefined) {
        if (latestPriceDataPoint.sma10 > latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 <= previousPriceDataPoint.sma20) {
            action = 'buy';
            triggerReason = "Cruce SMA Alcista";
        } else if (latestPriceDataPoint.sma10 < latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 >= previousPriceDataPoint.sma20) {
            action = 'sell';
            triggerReason = "Cruce SMA Bajista";
        }
        console.log(`[Bot Strategy - ${networkType} - SMA] SMA10: ${latestPriceDataPoint.sma10?.toFixed(2)}, SMA20: ${latestPriceDataPoint.sma20?.toFixed(2)}. Acción: ${action}`);
    } else {
        console.log(`[Bot Strategy - ${networkType} - SMA] Datos de SMA insuficientes.`);
    }

    if (action === 'hold' && latestPriceDataPoint.macdHistogram !== undefined && previousPriceDataPoint.macdHistogram !== undefined) {
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "MACD Histograma Positivo";
      } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "MACD Histograma Negativo";
      }
      console.log(`[Bot Strategy - ${networkType} - MACD] Histograma: ${latestPriceDataPoint.macdHistogram?.toFixed(4)}. Acción: ${action}`);
    } else if (action === 'hold') {
         console.log(`[Bot Strategy - ${networkType} - MACD] Datos de MACD insuficientes o SMA ya dio señal.`);
    }

    console.log(`[Bot Decision - ${networkType}] ${selectedMarket.symbol}: Acción: ${action.toUpperCase()}. Razón: ${triggerReason}`);

    if (action !== 'hold') {
        let tradeAmount = 0;

        if (!allBinanceBalances) {
            console.error(`[Bot Action - ${networkType}] Balances no cargados. No se puede determinar la cantidad.`);
            console.groupEnd();
            return;
        }

        const marketRules = selectedMarketRules; // Ya verificado arriba que no es null
        const minNotional = parseFloat(marketRules.limits.cost.min);
        const minQty = parseFloat(marketRules.limits.amount.min);
        const stepSize = parseFloat(marketRules.precision.amount);
        const amountPrecision = parseInt(marketRules.precision.amount_decimal_place || '8'); // Asumir 8 si no está definido
        const pricePrecision = parseInt(marketRules.precision.price_decimal_place || '2'); // Asumir 2 si no está definido
        const quotePrecision = marketRules.quotePrecision !== undefined ? marketRules.quotePrecision : pricePrecision;


        if (action === 'buy') {
            const quoteBalanceInfo = allBinanceBalances[selectedMarket.quoteAsset];
            if (!quoteBalanceInfo || quoteBalanceInfo.available <= 0) {
                console.warn(`[Bot Action - ${networkType} - Buy] Balance de ${selectedMarket.quoteAsset} insuficiente o no disponible.`);
                console.groupEnd();
                return;
            }
            const availableQuote = quoteBalanceInfo.available;
            const investmentPercentage = 0.05; // 5% del balance
            let desiredQuoteAmount = availableQuote * investmentPercentage;
            
            console.log(`[Bot Action - ${networkType} - Buy] Disponible ${selectedMarket.quoteAsset}: ${availableQuote.toFixed(quotePrecision)}. Intentando invertir ${desiredQuoteAmount.toFixed(quotePrecision)}.`);

            tradeAmount = parseFloat((desiredQuoteAmount / currentPrice).toFixed(amountPrecision));
             console.log(`[Bot Action - ${networkType} - Buy] Cantidad base inicial: ${tradeAmount} ${selectedMarket.baseAsset}.`);

            if (tradeAmount * currentPrice < minNotional) {
                tradeAmount = parseFloat((minNotional / currentPrice).toFixed(amountPrecision));
                console.log(`[Bot Action - ${networkType} - Buy] Ajustado por minNotional a: ${tradeAmount} ${selectedMarket.baseAsset}.`);
            }
            if (stepSize > 0) {
                tradeAmount = parseFloat((Math.floor(tradeAmount / stepSize) * stepSize).toFixed(amountPrecision));
                console.log(`[Bot Action - ${networkType} - Buy] Ajustado por stepSize a: ${tradeAmount} ${selectedMarket.baseAsset}.`);
            }
            if (tradeAmount < minQty) {
                console.warn(`[Bot Action - ${networkType} - Buy] Cantidad final ${tradeAmount} ${selectedMarket.baseAsset} < minQty ${minQty}. No se opera.`);
                console.groupEnd();
                return;
            }
        } else { // action === 'sell'
            if (!botOpenPosition || botOpenPosition.marketId !== selectedMarket.id) {
                console.warn(`[Bot Action - ${networkType} - Sell] No hay posición abierta para ${selectedMarket.symbol} o no coincide.`);
                console.groupEnd();
                return;
            }
            const baseBalanceInfo = allBinanceBalances[selectedMarket.baseAsset];
            if (!baseBalanceInfo || baseBalanceInfo.available < botOpenPosition.amount) {
                 console.warn(`[Bot Action - ${networkType} - Sell] Balance de ${selectedMarket.baseAsset} (${baseBalanceInfo?.available.toFixed(amountPrecision)}) insuficiente para vender posición de ${botOpenPosition.amount.toFixed(amountPrecision)}.`);
                console.groupEnd();
                return;
            }
            tradeAmount = botOpenPosition.amount; // Vender la cantidad de la posición abierta

            if (stepSize > 0) { // Aplicar stepSize también a la venta
                tradeAmount = parseFloat((Math.floor(tradeAmount / stepSize) * stepSize).toFixed(amountPrecision));
                console.log(`[Bot Action - ${networkType} - Sell] Ajustado por stepSize a: ${tradeAmount} ${selectedMarket.baseAsset}.`);
            }
            if (tradeAmount < minQty) {
                console.warn(`[Bot Action - ${networkType} - Sell] Cantidad final ${tradeAmount} ${selectedMarket.baseAsset} < minQty ${minQty}. No se opera.`);
                console.groupEnd();
                return;
            }
            if (tradeAmount * currentPrice < minNotional) {
                 console.warn(`[Bot Action - ${networkType} - Sell] Valor nocional de venta ${tradeAmount * currentPrice} < minNotional ${minNotional}. No se opera.`);
                console.groupEnd();
                return;
            }
        }

        if (tradeAmount <= 0) {
            console.warn(`[Bot Action - ${networkType}] Cantidad de trade final <= 0 para ${action} ${selectedMarket.symbol}. No se opera.`);
            console.groupEnd();
            return;
        }

        console.log(`[Bot Action - ${networkType}] Procediendo a colocar orden: ${action.toUpperCase()} ${tradeAmount.toFixed(amountPrecision)} de ${selectedMarket.symbol} a precio de mercado (ref: ${currentPrice.toFixed(pricePrecision)})`);

        setIsPlacingOrder(true);
        setPlaceOrderError(null);

        const orderData = {
            symbol: selectedMarket.symbol,
            type: 'market' as 'market' | 'limit',
            side: action,
            amount: tradeAmount,
            price: currentPrice,
        };

        const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';
        console.log(`[Bot Action - ${networkType}] Llamando endpoint: ${endpoint} con datos:`, orderData);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });
            const tradeResult = await response.json();
            console.log(`[Bot Action - ${networkType}] Respuesta del endpoint ${endpoint}:`, tradeResult);

            if (!response.ok || !tradeResult.success) {
                const errorMsg = tradeResult.message || tradeResult.details || `Error HTTP ${response.status}`;
                console.error(`[Bot Action - ${networkType}] Error al colocar orden: ${errorMsg}`);
                setPlaceOrderError(tradeResult || { message: errorMsg });
                if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
                toast({
                    title: `Bot (${networkType}): Error al Colocar Orden`,
                    description: `Problema en ${selectedMarket.symbol}: ${errorMsg}`,
                    variant: "destructive",
                });
            } else {
                console.log(`[Bot Action - ${networkType}] Orden colocada con éxito. ID: ${tradeResult.orderId}`);
                setBotLastActionTimestamp(Date.now());
                if (onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

                const executedQty = parseFloat(tradeResult.executedQty || tradeResult.amount);
                const executedPrice = parseFloat(tradeResult.price || currentPrice);

                if (action === 'buy') {
                    setBotOpenPosition({
                        marketId: selectedMarket.id,
                        entryPrice: executedPrice,
                        amount: executedQty,
                        type: 'buy',
                        timestamp: Math.floor((tradeResult.transactTime || Date.now()) / 1000),
                    });
                } else if (action === 'sell') {
                    if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                        const pnl = (executedPrice - botOpenPosition.entryPrice) * executedQty;
                        console.log(`[Bot Action - ${networkType}] PnL simulado: ${pnl.toFixed(quotePrecision)} ${selectedMarket.quoteAsset}`);
                    }
                    setBotOpenPosition(null);
                }
                toast({
                    title: `Bot (${networkType}): ${action === 'buy' ? 'Compra' : 'Venta'} Ejecutada`,
                    description: `Orden de ${executedQty.toFixed(amountPrecision)} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
                    variant: "default",
                });
            }
        } catch (fetchError: any) {
            const errorMsg = `Error de red al colocar orden: ${fetchError.message}`;
            console.error(`[Bot Action - ${networkType}] ${errorMsg}`, fetchError);
            setPlaceOrderError({ message: errorMsg, details: fetchError.message });
            if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: { message: errorMsg } });
            toast({
                title: `Bot (${networkType}): Error Crítico de Conexión`,
                description: `No se pudo conectar para operar en ${selectedMarket.symbol}. Detalles: ${errorMsg}`,
                variant: "destructive",
            });
        } finally {
            setIsPlacingOrder(false);
        }
    } else {
        console.log(`[Bot Action - ${networkType}] No se tomó acción de compra/venta.`);
    }
    console.groupEnd();
  }, [
    isBotRunning,
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice,
    allBinanceBalances,
    botLastActionTimestamp,
    botOpenPosition,
    toast,
    useTestnet,
    onBotAction,
    selectedMarketRules,
    marketRulesError, // Añadido por si queremos reaccionar a cambios en este error
    networkType
  ]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    console.log(`[useTradingBot - ${networkType}] Efecto principal: isBotRunning=${isBotRunning}, mercado=${selectedMarket?.symbol}, reglasCargadas=${!!selectedMarketRules}, errorReglas=${marketRulesError}`);

    if (isBotRunning && selectedMarket && selectedMarketRules) {
        console.log(`[useTradingBot - ${networkType}] Bot Iniciado para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s.`);
        if (botIntervalRef.current) clearInterval(botIntervalRef.current);
        executeBotStrategy(); // Ejecución inmediata
        intervalId = setInterval(executeBotStrategy, botIntervalMs);
        botIntervalRef.current = intervalId;
    } else {
        if (botIntervalRef.current) {
            console.log(`[useTradingBot - ${networkType}] Bot Detenido o condiciones no cumplidas. Limpiando intervalo.`);
            if (!selectedMarket) console.log(`[useTradingBot - ${networkType}] Razón: No hay mercado seleccionado.`);
            if (!selectedMarketRules) console.log(`[useTradingBot - ${networkType}] Razón: Reglas no cargadas. Error: ${marketRulesError}`);
            clearInterval(botIntervalRef.current);
            botIntervalRef.current = null;
        } else {
            console.log(`[useTradingBot - ${networkType}] Bot Detenido o condiciones no cumplidas. No había intervalo activo.`);
        }
    }
    return () => {
        if (intervalId) clearInterval(intervalId);
        if (botIntervalRef.current) { // Limpieza adicional por si acaso
             clearInterval(botIntervalRef.current);
             botIntervalRef.current = null;
        }
        console.log(`[useTradingBot - ${networkType}] Limpieza del efecto principal.`);
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, selectedMarketRules, marketRulesError, networkType]);

  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
        const newStatus = !prev;
        console.log(`[useTradingBot - ${networkType}] toggleBotStatus: Cambiando estado del bot a ${newStatus} para ${selectedMarket?.symbol || 'mercado no seleccionado'}`);
        setTimeout(() => { // Defer toast
            toast({
                title: `Bot ${newStatus ? "Iniciado" : "Detenido"} (${networkType})`,
                description: `El bot ahora está ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'el mercado no seleccionado'}.`,
                variant: newStatus ? "default" : "destructive",
            });
        }, 0);
        return newStatus;
    });
  }, [toast, selectedMarket, networkType]);


  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder,
    placeOrderError,
    selectedMarketRules,
    marketRulesError,
  };
};

    