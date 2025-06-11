
// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Market, MarketPriceDataPoint, OrderFormData, SimulatedPosition, Balance as FormattedBalance, UseTradingBotProps, UseTradingBotReturn } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";

console.log('[useTradingBot] Hook execution start - Version: 2024-06-08_A'); // Debug log

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  botIntervalMs = 30000,
  onBotAction,
  isBotRunning,
  setIsBotRunning,
}: UseTradingBotProps): UseTradingBotReturn => {
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<any>(null);
  const [selectedMarketRules, setSelectedMarketRules] = useState<any>(null);
  const [marketRulesError, setMarketRulesError] = useState<string | null>(null);

  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

  const fetchMarketRules = useCallback(async () => {
    console.log(`[useTradingBot] Iniciando fetch de reglas del mercado.`);
    if (!selectedMarket) {
      console.log(`[useTradingBot] selectedMarket es nulo. Limpiando reglas del mercado.`);
      setSelectedMarketRules(null);
      setMarketRulesError(null);
      return;
    }
    console.log(`[useTradingBot] Fetching exchange info for ${selectedMarket.symbol} (Mainnet)...`);
    setMarketRulesError(null);

    const endpoint = `/api/binance/exchange-info?symbol=${selectedMarket.id}`; // Use selectedMarket.id for Binance symbol

    try {
      const response = await fetch(endpoint);
      const data = await response.json();

      if (response.ok && data.success && data.data) {
        console.log(`[useTradingBot] Reglas del mercado ${selectedMarket.symbol} (Mainnet) obtenidas.`);
        setSelectedMarketRules(data.data);
      } else {
        const errorMsg = data.message || data.details || `Error HTTP ${response.status} al obtener reglas para ${selectedMarket.symbol}.`;
        console.error(`[useTradingBot] Error al cargar reglas para ${selectedMarket.symbol} (Mainnet): ${errorMsg}`, data);
        setSelectedMarketRules(null);
        setMarketRulesError(errorMsg);
        toast({
          title: "Error al Cargar Reglas (Mainnet)",
          description: `No se pudieron obtener las reglas para ${selectedMarket.symbol}. Detalles: ${errorMsg}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMsg = `Error de conexión o al parsear reglas: ${error.message}`;
      console.error(`[useTradingBot] Fetch error en market rules para ${selectedMarket.symbol} (Mainnet): ${errorMsg}`, error);
      setSelectedMarketRules(null);
      setMarketRulesError(errorMsg);
      toast({
        title: "Error de Conexión (Reglas Mercado - Mainnet)",
        description: `No se pudo conectar para obtener las reglas del mercado ${selectedMarket.symbol}. Detalles: ${error.message}`,
        variant: "destructive",
      });
    }
  }, [selectedMarket, toast]);

  useEffect(() => {
    fetchMarketRules();
  }, [fetchMarketRules]);

  const executeBotStrategy = useCallback(async () => {
    console.groupCollapsed(`[Bot Strategy - Mainnet] Ejecución ${new Date().toLocaleTimeString()} para ${selectedMarket?.symbol}`);

    if (!isBotRunning) {
      console.log(`[Bot Strategy - Mainnet] Bot no está corriendo. Saliendo.`);
      console.groupEnd();
      return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20 || !selectedMarketRules) {
      console.warn(`[Bot Strategy - Mainnet] Datos insuficientes (mercado, precio, historial o reglas) para ejecutar la estrategia.`);
      if (!selectedMarket) console.warn(`[Bot Strategy - Mainnet] Razón: selectedMarket es nulo.`);
      if (!currentPrice || currentPrice <= 0) console.warn(`[Bot Strategy - Mainnet] Razón: currentPrice es inválido (${currentPrice}).`);
      if (currentMarketPriceHistory.length < 20) console.warn(`[Bot Strategy - Mainnet] Razón: historial de precios corto (${currentMarketPriceHistory.length}).`);
      if (!selectedMarketRules) console.warn(`[Bot Strategy - Mainnet] Razón: Reglas del mercado no cargadas. ${marketRulesError || ''}`);
      console.groupEnd();
      return;
    }
    console.log(`[Bot Strategy - Mainnet] Condiciones iniciales cumplidas. Procediendo con la estrategia para ${selectedMarket.name} a precio: ${currentPrice}.`);
    console.log(`[Bot Strategy - Mainnet] Reglas del mercado disponibles:`, selectedMarketRules);

    const timeSinceLastAction = Date.now() - botLastActionTimestamp;
    if (timeSinceLastAction < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy - Mainnet] Esperando intervalo mínimo entre acciones. Faltan ${BOT_MIN_ACTION_INTERVAL_MS - timeSinceLastAction}ms.`);
      console.groupEnd();
      return;
    }

    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2];

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    console.log(`[Bot Strategy - Mainnet - SMA] Evaluando...`);
    if (latestPriceDataPoint.sma10 !== undefined && latestPriceDataPoint.sma20 !== undefined &&
        previousPriceDataPoint.sma10 !== undefined && previousPriceDataPoint.sma20 !== undefined) {
      if (latestPriceDataPoint.sma10 > latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 <= previousPriceDataPoint.sma20) {
        action = 'buy';
        triggerReason = "Cruce SMA Alcista";
      } else if (latestPriceDataPoint.sma10 < latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 >= previousPriceDataPoint.sma20) {
        action = 'sell';
        triggerReason = "Cruce SMA Bajista";
      }
    }

    if (action === 'hold') {
      console.log(`[Bot Strategy - Mainnet - MACD] Evaluando...`);
      if (latestPriceDataPoint.macdHistogram !== undefined && previousPriceDataPoint.macdHistogram !== undefined) {
        if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
          action = 'buy';
          triggerReason = "MACD Histograma Positivo";
        } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
          action = 'sell';
          triggerReason = "MACD Histograma Negativo";
        }
      }
    }
    console.log(`[Bot Decision - Mainnet] ${selectedMarket.symbol}: Acción: ${action.toUpperCase()} por: ${triggerReason}`);

    if (action !== 'hold') {
      console.log(`[Bot Action - Mainnet] Preparando para ejecutar: ${action.toUpperCase()}.`);
      let tradeAmount = 0;

      if (!allBinanceBalances) {
        console.error(`[Bot Action - Mainnet] Balances no cargados. Abortando.`);
        console.groupEnd();
        return;
      }

      const marketRules = selectedMarketRules;
      const minNotional = parseFloat(marketRules.limits.cost.min);
      const minQty = parseFloat(marketRules.limits.amount.min);
      // stepSize from CCXT's market.precision.amount is the "tick size" for amount.
      // It's the smallest increment the amount can change by.
      const stepSize = marketRules.precision?.amount ? parseFloat(marketRules.precision.amount) : 0;


      let amountPrecisionPlaces = 0;
        // Determine precision from stepSize (e.g., 0.001 -> 3 places, 1 -> 0 places)
        if (stepSize > 0 && stepSize < 1) {
            const stepSizeStr = stepSize.toString();
            amountPrecisionPlaces = stepSizeStr.includes('.') ? stepSizeStr.split('.')[1].length : 0;
        } else if (stepSize === 1) { // If stepSize is 1, precision is 0 decimal places
            amountPrecisionPlaces = 0;
        } else { // Fallback if stepSize is 0 or not a typical fractional value, or if precision from market is better
            amountPrecisionPlaces = selectedMarket.amountPrecision !== undefined ? selectedMarket.amountPrecision : 6;
        }
      console.log(`[Bot Action - Mainnet] Precisión de cantidad para ${selectedMarket.baseAsset}: ${amountPrecisionPlaces} decimales (StepSize de Regla: ${stepSize}, Fallback amountPrecision: ${selectedMarket.amountPrecision})`);


      if (action === 'buy') {
        const quoteBalanceInfo = allBinanceBalances[selectedMarket.quoteAsset];
        if (!quoteBalanceInfo || quoteBalanceInfo.available <= 0) {
          console.warn(`[Bot Action - Mainnet] Sin balance de ${selectedMarket.quoteAsset} para comprar.`);
          console.groupEnd();
          return;
        }
        const availableQuote = quoteBalanceInfo.available;
        const investmentPercentage = 0.05; 
        let desiredQuoteAmount = availableQuote * investmentPercentage;

        if (!currentPrice || currentPrice <= 0) {
            console.error(`[Bot Action - Mainnet - Buy] Precio actual inválido (${currentPrice}). Abortando.`);
            console.groupEnd(); return;
        }
        tradeAmount = desiredQuoteAmount / currentPrice;

        if ((tradeAmount * currentPrice) < minNotional) {
          tradeAmount = (minNotional / currentPrice) * 1.01; // Ensure slightly above minNotional
          console.log(`[Bot Action - Mainnet - Buy] Ajustando tradeAmount (antes de stepSize) a ${tradeAmount.toFixed(amountPrecisionPlaces + 2)} para cumplir minNotional.`);
        }
        if (stepSize > 0) {
          tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
        }
        tradeAmount = parseFloat(tradeAmount.toFixed(amountPrecisionPlaces));

        if (tradeAmount < minQty || tradeAmount <= 0) {
          console.warn(`[Bot Action - Mainnet - Buy] Cantidad final (${tradeAmount}) no cumple minQty (${minQty}) o es <=0. Abortando.`);
          console.groupEnd();
          return;
        }
      } else { // action === 'sell'
        if (!botOpenPosition || botOpenPosition.marketId !== selectedMarket.id) {
          console.warn(`[Bot Action - Mainnet] Sin posición abierta simulada para vender en ${selectedMarket.symbol}.`);
          console.groupEnd();
          return;
        }
        const baseBalanceInfo = allBinanceBalances[selectedMarket.baseAsset];
        if (!baseBalanceInfo || baseBalanceInfo.available < botOpenPosition.amount) {
          console.warn(`[Bot Action - Mainnet] Balance de ${selectedMarket.baseAsset} (${baseBalanceInfo?.available || 0}) insuficiente para vender posición simulada (${botOpenPosition.amount}).`);
          setBotOpenPosition(null);
          console.groupEnd();
          return;
        }
        tradeAmount = botOpenPosition.amount;
        if (stepSize > 0) {
          tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
        }
        tradeAmount = parseFloat(tradeAmount.toFixed(amountPrecisionPlaces));

        if (tradeAmount < minQty || tradeAmount <= 0) {
          console.warn(`[Bot Action - Mainnet - Sell] Cantidad final (${tradeAmount}) no cumple minQty (${minQty}) o es <=0. Abortando.`);
          setBotOpenPosition(null);
          console.groupEnd();
          return;
        }
        if (!currentPrice || currentPrice <= 0) {
            console.error(`[Bot Action - Mainnet - Sell] Precio actual inválido (${currentPrice}) para validar nominal. Abortando.`);
            setBotOpenPosition(null); console.groupEnd(); return;
        }
        if ((tradeAmount * currentPrice) < minNotional) {
           console.warn(`[Bot Action - Mainnet - Sell] Nominal de venta (${(tradeAmount * currentPrice).toFixed(selectedMarket.quotePrecision || 2)}) por debajo de minNotional (${minNotional}). Abortando.`);
           setBotOpenPosition(null);
           console.groupEnd();
           return;
        }
      }
      console.log(`[Bot Action - Mainnet] Cantidad validada para ${action.toUpperCase()}: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      setIsPlacingOrder(true);
      setPlaceOrderError(null);

      const orderPayload = {
        symbol: selectedMarket.symbol, 
        type: 'market' as 'market' | 'limit',
        side: action,
        amount: tradeAmount,
      };

      const endpoint = '/api/binance/trade';
      console.log(`[useTradingBot - Mainnet] Bot llamando al endpoint: ${endpoint} con payload:`, JSON.stringify(orderPayload));

      let tradeResult: any = null;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
        tradeResult = await response.json();
        console.log(`[useTradingBot - Mainnet] Respuesta del endpoint ${endpoint} (Orden Bot):`, tradeResult);

        if (!response.ok || !tradeResult.success) {
          const errorMsg = tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`;
          console.error(`[useTradingBot - Mainnet] Endpoint ${endpoint} reportó error en operación: ${errorMsg}`);
          setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
          toast({
            title: `Bot: Error al Colocar Orden (Mainnet)`,
            description: `Error en ${selectedMarket.symbol}: ${errorMsg}`,
            variant: "destructive",
          });
        } else {
          console.log(`[useTradingBot - Mainnet] Orden del bot en ${selectedMarket.symbol} exitosa. ID: ${tradeResult.orderId}`);
          setBotLastActionTimestamp(Date.now());
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

          if (action === 'buy') {
            const filledAmount = parseFloat(tradeResult.filled || tradeAmount.toString());
            const entryPrice = parseFloat(tradeResult.price || currentPrice?.toString() || "0");
            // Preferir timestamp de la respuesta si está disponible y es un número válido
            const transactionTime = typeof tradeResult.transactTime === 'number' ? tradeResult.transactTime : (typeof tradeResult.time === 'number' ? tradeResult.time : Date.now());
            const timestampInSeconds = Math.floor(transactionTime / 1000);


            setBotOpenPosition({
              marketId: selectedMarket.id,
              entryPrice: entryPrice,
              amount: filledAmount,
              type: 'buy',
              timestamp: timestampInSeconds 
            });
            toast({
              title: `Bot: Compra Ejecutada (Mainnet)`,
              description: `Orden de ${filledAmount.toFixed(amountPrecisionPlaces)} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
              variant: "default",
            });
          } else if (action === 'sell') {
            if (botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
              const exitPrice = parseFloat(tradeResult.price || currentPrice?.toString() || "0");
              const executedAmount = parseFloat(tradeResult.filled || tradeAmount.toString());
              const pnl = (exitPrice - botOpenPosition.entryPrice) * executedAmount;
              console.log(`[useTradingBot - Mainnet] PnL simulado: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`);
            }
            setBotOpenPosition(null);
            toast({
              title: `Bot: Venta Ejecutada (Mainnet)`,
              description: `Orden de ${(tradeResult.filled || tradeAmount).toFixed(amountPrecisionPlaces)} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
              variant: "default",
            });
          }
        }
      } catch (fetchError: any) {
        const errorDetails = { message: `Error de red al colocar orden en Mainnet.`, details: fetchError.message };
        console.error(`[useTradingBot - Mainnet] Error fetch en endpoint ${endpoint}:`, fetchError);
        setPlaceOrderError(errorDetails);
        if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });
        toast({
          title: `Bot: Error Crítico Conexión (Mainnet)`,
          description: `No se pudo comunicar con el servidor para ${selectedMarket.symbol}. Detalles: ${errorDetails.details}`,
          variant: "destructive",
        });
      } finally {
        setIsPlacingOrder(false);
      }
    } else {
      console.log(`[Bot Action - Mainnet] No se decidió acción (${action}).`);
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
    onBotAction,
    selectedMarketRules,
    marketRulesError,
    setIsPlacingOrder,
    setPlaceOrderError,
    setBotLastActionTimestamp,
    setBotOpenPosition,
  ]);

  useEffect(() => {
    console.log(`[useTradingBot - Mainnet] Efecto ciclo de vida. Bot: ${isBotRunning}, Mercado: ${selectedMarket?.symbol}, Reglas: ${!!selectedMarketRules}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket && selectedMarketRules) {
      console.log(`[useTradingBot - Mainnet] Bot INICIADO para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
      }
      // No llamar executeBotStrategy() inmediatamente aquí si ya se llama en el intervalo y queremos que se respeten los tiempos.
      // O si se llama, asegurar que respete BOT_MIN_ACTION_INTERVAL_MS si es relevante al inicio.
      // Por ahora, el intervalo se encargará de la primera ejecución tras el delay.
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId;
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot - Mainnet] Bot DETENIDO o condiciones no cumplidas. Limpiando intervalo para ${selectedMarket?.symbol || 'ningún mercado'}.`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
        console.log(`[useTradingBot - Mainnet] Bot DETENIDO o condiciones no cumplidas. No había intervalo activo para ${selectedMarket?.symbol || 'ningún mercado'}.`);
      }
       if(!selectedMarket) console.log(`[useTradingBot - Mainnet] Razón: No hay mercado seleccionado.`);
       if(!selectedMarketRules) console.log(`[useTradingBot - Mainnet] Razón: Reglas del mercado no cargadas. ${marketRulesError || ''}`);
    }

    return () => {
      console.log(`[useTradingBot - Mainnet] Limpieza efecto ciclo de vida para ${selectedMarket?.symbol || 'ningún mercado'}.`);
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Asegurarse de limpiar la ref correcta si el intervalo que se está limpiando es el actual.
      if (botIntervalRef.current && botIntervalRef.current === intervalId) { 
           botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, selectedMarketRules, marketRulesError]);

  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      console.log(`[useTradingBot] Cambiando estado del bot a: ${newStatus} para ${selectedMarket?.symbol || 'el mercado seleccionado'} en Mainnet.`);
      setTimeout(() => {
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"} (Mainnet)`,
          description: `El bot ahora está ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'el mercado actual'}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast, selectedMarket, setIsBotRunning]);

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

    