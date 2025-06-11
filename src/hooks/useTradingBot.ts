
// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
// Asegúrate de que estos tipos estén bien definidos y exportados
import type { Market, MarketPriceDataPoint, OrderFormData, SimulatedPosition } from '@/lib/types';

import { useToast } from "@/hooks/use-toast"; // Si el hook usará toasts

// Asegúrate de que esta interfaz FormattedBalance esté definida o importada
interface FormattedBalance {
    available: number;
    onOrder: number;
    total: number;
}

interface UseTradingBotProps {
  selectedMarket: Market | null;
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null; // El precio actual más reciente
  allBinanceBalances: Record<string, FormattedBalance> | null;
  botIntervalMs?: number; // Intervalo de ejecución del bot en ms
  useTestnet?: boolean; // Indica si el bot debe operar en la red de prueba
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void; // Opcional: Callback para notificar al UI
  isBotRunning: boolean;
  setIsBotRunning: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseTradingBotReturn {
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  botOpenPosition: SimulatedPosition | null;
  botLastActionTimestamp: number;
  isPlacingOrder: boolean;
  placeOrderError: any; 
  selectedMarketRules: any; 
  marketRulesError: string | null;
}

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  botIntervalMs = 15000, 
  useTestnet = false, 
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
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    if (!selectedMarket) {
      console.log(`[useTradingBot - ${networkType}] selectedMarket es nulo. Limpiando reglas del mercado.`);
      setSelectedMarketRules(null);
      setMarketRulesError(null); // También limpiar error si no hay mercado
      return;
    }

    console.log(`[useTradingBot - ${networkType}] Fetching exchange info for ${selectedMarket.symbol}...`);
    setMarketRulesError(null); // Limpiar error de reglas antes de cada intento

    const endpoint = `/api/binance/exchange-info?symbol=${selectedMarket.symbol}&isTestnet=${useTestnet}`;

    try {
      const response = await fetch(endpoint);
      const data = await response.json();

      console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: HTTP Status for rules: ${response.status}`);
      console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: Raw response data for rules:`, data);

      if (response.ok && data.success && data.data) {
        setSelectedMarketRules(data.data);
        console.log(`[useTradingBot - ${networkType}] Reglas del mercado ${selectedMarket.symbol} almacenadas:`, data.data);
      } else {
        const errorMsg = data.message || data.details || `Error HTTP ${response.status} al obtener reglas para ${selectedMarket.symbol}.`;
        console.error(`[useTradingBot - ${networkType}] Error al cargar reglas: ${errorMsg}`, data);
        setSelectedMarketRules(null);
        setMarketRulesError(errorMsg);
        toast({
          title: "Error al Cargar Reglas del Mercado",
          description: `No se pudieron obtener las reglas para ${selectedMarket.symbol} en ${networkType}. Detalles: ${errorMsg}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMsg = `Error de conexión o al parsear reglas para ${selectedMarket.symbol}: ${error.message}`;
      console.error(`[useTradingBot - ${networkType}] Fetch error en market rules: ${errorMsg}`, error);
      setSelectedMarketRules(null);
      setMarketRulesError(errorMsg);
      toast({
        title: "Error de Conexión (Reglas Mercado)",
        description: `No se pudo conectar para obtener las reglas del mercado ${selectedMarket.symbol}. Detalles: ${error.message}`,
        variant: "destructive",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket, useTestnet, toast]);

  useEffect(() => {
    fetchMarketRules();
  }, [fetchMarketRules]);
  
  const executeBotStrategy = useCallback(async () => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.groupCollapsed(`[Bot Strategy - ${networkType}] Ejecución ${new Date().toLocaleTimeString()} para ${selectedMarket?.symbol}`);

    if (!isBotRunning) {
      console.log(`[Bot Strategy - ${networkType}] Bot no está corriendo. Saliendo.`);
      console.groupEnd();
      return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20 || !selectedMarketRules) {
      console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes (mercado, precio, historial o reglas) para ejecutar la estrategia.`);
      if (!selectedMarket) console.warn(`[Bot Strategy - ${networkType}] Razón: selectedMarket es nulo.`);
      if (!currentPrice || currentPrice <= 0) console.warn(`[Bot Strategy - ${networkType}] Razón: currentPrice es inválido (${currentPrice}).`);
      if (currentMarketPriceHistory.length < 20) console.warn(`[Bot Strategy - ${networkType}] Razón: historial de precios corto (${currentMarketPriceHistory.length}).`);
      if (!selectedMarketRules) console.warn(`[Bot Strategy - ${networkType}] Razón: Reglas del mercado no cargadas. ${marketRulesError || ''}`);
      console.groupEnd();
      return;
    }
    console.log(`[Bot Strategy - ${networkType}] Condiciones iniciales cumplidas. Procediendo con la estrategia para ${selectedMarket.name} a precio: ${currentPrice}.`);
    console.log(`[Bot Strategy - ${networkType}] Reglas del mercado disponibles:`, selectedMarketRules);

    const timeSinceLastAction = Date.now() - botLastActionTimestamp;
    if (timeSinceLastAction < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy - ${networkType}] Esperando intervalo mínimo entre acciones. Faltan ${BOT_MIN_ACTION_INTERVAL_MS - timeSinceLastAction}ms.`);
      console.groupEnd();
      return;
    }

    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2];

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    console.log(`[Bot Strategy - ${networkType} - SMA] Evaluando...`);
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
      console.log(`[Bot Strategy - ${networkType} - MACD] Evaluando...`);
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
    console.log(`[Bot Decision - ${networkType}] ${selectedMarket.symbol}: Acción: ${action.toUpperCase()} por: ${triggerReason}`);

    if (action !== 'hold') {
      console.log(`[Bot Action - ${networkType}] Preparando para ejecutar: ${action.toUpperCase()}.`);
      let tradeAmount = 0;

      if (!allBinanceBalances) {
        console.error(`[Bot Action - ${networkType}] Balances no cargados. Abortando.`);
        console.groupEnd();
        return;
      }

      const marketRules = selectedMarketRules; 
      const minNotional = parseFloat(marketRules.limits.cost.min);
      const minQty = parseFloat(marketRules.limits.amount.min);
      const stepSize = parseFloat(marketRules.precision.amount);
      
      // Obtener la precisión de la cantidad del activo base de las reglas del mercado
      // ccxt suele devolver la precisión como un número (ej. 0.001 -> 3 decimales, 1 -> 0 decimales)
      // Necesitamos convertir esto a la cantidad de decimales para toFixed()
      // Si marketRules.precision.amount es, por ejemplo, 0.00001, queremos 5 decimales.
      let amountPrecisionPlaces = 0;
      if (marketRules.precision && typeof marketRules.precision.amount === 'number') {
        if (marketRules.precision.amount > 0 && marketRules.precision.amount < 1) {
            const precisionString = marketRules.precision.amount.toString();
            amountPrecisionPlaces = precisionString.includes('.') ? precisionString.split('.')[1].length : 0;
        } else if (marketRules.precision.amount === 1) { // Si la precisión es 1, significa 0 decimales
            amountPrecisionPlaces = 0;
        } else { // Fallback o si es un entero mayor a 1, asumir 0 decimales
            amountPrecisionPlaces = selectedMarket.amountPrecision || 6; // Fallback a la precisión definida en Market o 6
        }
      } else {
        amountPrecisionPlaces = selectedMarket.amountPrecision || 6; // Fallback
      }
      console.log(`[Bot Action - ${networkType}] Precisión de cantidad para ${selectedMarket.baseAsset}: ${amountPrecisionPlaces} decimales (Regla: ${marketRules.precision?.amount})`);


      if (action === 'buy') {
        const quoteBalanceInfo = allBinanceBalances[selectedMarket.quoteAsset];
        if (!quoteBalanceInfo || quoteBalanceInfo.available <= 0) {
          console.warn(`[Bot Action - ${networkType}] Sin balance de ${selectedMarket.quoteAsset} para comprar.`);
          console.groupEnd();
          return;
        }
        const availableQuote = quoteBalanceInfo.available;
        const investmentPercentage = 0.05; // Invertir 5%
        let desiredQuoteAmount = availableQuote * investmentPercentage;
        
        if (!currentPrice || currentPrice <= 0) {
            console.error(`[Bot Action - ${networkType} - Buy] Precio actual inválido (${currentPrice}). Abortando.`);
            console.groupEnd(); return;
        }
        tradeAmount = desiredQuoteAmount / currentPrice;
        
        if ((tradeAmount * currentPrice) < minNotional) {
          tradeAmount = (minNotional / currentPrice) * 1.01; // Añadir un pequeño margen para asegurar minNotional
          console.log(`[Bot Action - ${networkType} - Buy] Ajustando tradeAmount a ${tradeAmount.toFixed(amountPrecisionPlaces)} para cumplir minNotional.`);
        }
        if (stepSize > 0) {
          tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
        }
        tradeAmount = parseFloat(tradeAmount.toFixed(amountPrecisionPlaces));

        if (tradeAmount < minQty || tradeAmount <= 0) {
          console.warn(`[Bot Action - ${networkType} - Buy] Cantidad final (${tradeAmount}) no cumple minQty (${minQty}) o es <=0. Abortando.`);
          console.groupEnd();
          return;
        }
      } else { // action === 'sell'
        if (!botOpenPosition || botOpenPosition.marketId !== selectedMarket.id) {
          console.warn(`[Bot Action - ${networkType}] Sin posición abierta simulada para vender en ${selectedMarket.symbol}.`);
          console.groupEnd();
          return;
        }
        const baseBalanceInfo = allBinanceBalances[selectedMarket.baseAsset];
        if (!baseBalanceInfo || baseBalanceInfo.available < botOpenPosition.amount) {
          console.warn(`[Bot Action - ${networkType}] Balance de ${selectedMarket.baseAsset} (${baseBalanceInfo?.available || 0}) insuficiente para vender posición simulada (${botOpenPosition.amount}).`);
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
          console.warn(`[Bot Action - ${networkType} - Sell] Cantidad final (${tradeAmount}) no cumple minQty (${minQty}) o es <=0. Abortando.`);
          setBotOpenPosition(null);
          console.groupEnd();
          return;
        }
        if (!currentPrice || currentPrice <= 0) {
            console.error(`[Bot Action - ${networkType} - Sell] Precio actual inválido (${currentPrice}) para validar nominal. Abortando.`);
            setBotOpenPosition(null); console.groupEnd(); return;
        }
        if ((tradeAmount * currentPrice) < minNotional) {
           console.warn(`[Bot Action - ${networkType} - Sell] Nominal de venta (${(tradeAmount * currentPrice).toFixed(selectedMarket.quotePrecision || 2)}) por debajo de minNotional (${minNotional}). Abortando.`);
           setBotOpenPosition(null);
           console.groupEnd();
           return;
        }
      }
      console.log(`[Bot Action - ${networkType}] Cantidad validada para ${action.toUpperCase()}: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      setIsPlacingOrder(true);
      setPlaceOrderError(null);

      const orderPayload = {
        symbol: selectedMarket.symbol, // CCXT espera 'BASE/QUOTE'
        type: 'market' as 'market' | 'limit', 
        side: action,
        amount: tradeAmount,
        isTestnet: useTestnet, // Enviar el flag de testnet
      };

      const endpoint = '/api/binance/trade'; 
      console.log(`[useTradingBot - ${networkType}] Bot llamando al endpoint: ${endpoint} con payload:`, JSON.stringify(orderPayload));

      let tradeResult: any = null;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
        tradeResult = await response.json();
        console.log(`[useTradingBot - ${networkType}] Respuesta del endpoint ${endpoint} (Orden Bot):`, tradeResult);

        if (!response.ok || !tradeResult.success) {
          const errorMsg = tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`;
          console.error(`[useTradingBot - ${networkType}] Endpoint ${endpoint} reportó error en operación: ${errorMsg}`);
          setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
          toast({
            title: `Bot: Error al Colocar Orden (${networkType})`,
            description: `Error en ${selectedMarket.symbol}: ${errorMsg}`,
            variant: "destructive",
          });
        } else {
          console.log(`[useTradingBot - ${networkType}] Orden del bot en ${selectedMarket.symbol} exitosa. ID: ${tradeResult.orderId}`);
          setBotLastActionTimestamp(Date.now());
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

          if (action === 'buy') {
            const filledAmount = parseFloat(tradeResult.filled || tradeAmount.toString());
            const entryPrice = parseFloat(tradeResult.price || currentPrice?.toString() || "0");
            const timestamp = tradeResult.timestamp ? Math.floor(tradeResult.timestamp / 1000) : Math.floor(Date.now() / 1000);

            setBotOpenPosition({
              marketId: selectedMarket.id, 
              entryPrice: entryPrice, 
              amount: filledAmount, 
              type: 'buy',
              timestamp: timestamp 
            });
            toast({
              title: `Bot: Compra Ejecutada (${networkType})`,
              description: `Orden de ${filledAmount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
              variant: "default",
            });
          } else if (action === 'sell') {
            if (botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
              const exitPrice = parseFloat(tradeResult.price || currentPrice?.toString() || "0");
              const executedAmount = parseFloat(tradeResult.filled || tradeAmount.toString());
              const pnl = (exitPrice - botOpenPosition.entryPrice) * executedAmount;
              console.log(`[useTradingBot - ${networkType}] PnL simulado: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`);
            }
            setBotOpenPosition(null);
            toast({
              title: `Bot: Venta Ejecutada (${networkType})`,
              description: `Orden de ${tradeResult.filled || tradeAmount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
              variant: "default",
            });
          }
        }
      } catch (fetchError: any) {
        const errorDetails = { message: `Error de red al colocar orden en ${networkType}.`, details: fetchError.message };
        console.error(`[useTradingBot - ${networkType}] Error fetch en endpoint ${endpoint}:`, fetchError);
        setPlaceOrderError(errorDetails);
        if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });
        toast({
          title: `Bot: Error Crítico Conexión (${networkType})`,
          description: `No se pudo comunicar con el servidor para ${selectedMarket.symbol}. Detalles: ${errorDetails.details}`,
          variant: "destructive",
        });
      } finally {
        setIsPlacingOrder(false);
      }
    } else {
      console.log(`[Bot Action - ${networkType}] No se decidió acción (${action}).`);
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
    marketRulesError, 
    setIsPlacingOrder, 
    setPlaceOrderError,
    setBotLastActionTimestamp,
    setBotOpenPosition,
  ]);

  useEffect(() => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot - ${networkType}] Efecto ciclo de vida. Bot: ${isBotRunning}, Mercado: ${selectedMarket?.symbol}, Reglas: ${!!selectedMarketRules}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket && selectedMarketRules) {
      console.log(`[useTradingBot - ${networkType}] Bot INICIADO para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
      }
      executeBotStrategy(); 
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId;
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot - ${networkType}] Bot DETENIDO o condiciones no cumplidas. Limpiando intervalo para ${selectedMarket?.symbol || 'ningún mercado'}.`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
        console.log(`[useTradingBot - ${networkType}] Bot DETENIDO o condiciones no cumplidas. No había intervalo activo para ${selectedMarket?.symbol || 'ningún mercado'}.`);
      }
       if(!selectedMarket) console.log(`[useTradingBot - ${networkType}] Razón: No hay mercado seleccionado.`);
       if(!selectedMarketRules) console.log(`[useTradingBot - ${networkType}] Razón: Reglas del mercado no cargadas. ${marketRulesError || ''}`);
    }

    return () => {
      console.log(`[useTradingBot - ${networkType}] Limpieza efecto ciclo de vida para ${selectedMarket?.symbol || 'ningún mercado'}.`);
      if (intervalId) { 
        clearInterval(intervalId);
      }
      if (botIntervalRef.current && botIntervalRef.current === intervalId) {
           botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet, selectedMarketRules, marketRulesError]);

  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      const networkType = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot - ${networkType}] Cambiando estado del bot a: ${newStatus} para ${selectedMarket?.symbol || 'el mercado seleccionado'}`);
      setTimeout(() => {
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"} (${networkType})`,
          description: `El bot ahora está ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'el mercado actual'}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast, selectedMarket, useTestnet, setIsBotRunning]); 

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

    