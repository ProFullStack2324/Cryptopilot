
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
  useTestnet?: boolean; // Nuevo: Indica si el bot debe operar en la red de prueba
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void; // Opcional: Callback para notificar al UI
}

interface UseTradingBotReturn {
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  botOpenPosition: SimulatedPosition | null;
  botLastActionTimestamp: number;
  isPlacingOrder: boolean;
  placeOrderError: any; 
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

  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

  // Efecto para cargar las reglas del mercado (exchange info)
  useEffect(() => {
    const fetchMarketRules = async () => {
      if (!selectedMarket) {
        // console.log(`[useTradingBot] fetchMarketRules: selectedMarket es nulo. Limpiando reglas.`); // Log original
        setSelectedMarketRules(null);
        return;
      }

      const networkType = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot - ${networkType}] fetchMarketRules: Iniciando para ${selectedMarket.symbol}.`);

      const endpoint = `/api/binance/exchange-info?symbol=${selectedMarket.symbol}&isTestnet=${useTestnet}`;
      console.log(`[useTradingBot - ${networkType}] fetchMarketRules: Llamando a endpoint: ${endpoint}`);

      try {
        const response = await fetch(endpoint);
        const data = await response.json();

        // *** INICIO DE LOGS AÑADIDOS PARA DEPURACIÓN ***
        console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: HTTP Status for rules: ${response.status}`);
        console.log(`[useTradingBot - ${networkType}] DEBUG fetchMarketRules: Raw response data for rules:`, data);
        // *** FIN DE LOGS AÑADIDOS PARA DEPURACIÓN ***

        if (response.ok && data.success) {
          console.log(`[useTradingBot - ${networkType}] fetchMarketRules: Reglas obtenidas con éxito para ${selectedMarket.symbol}.`);
          setSelectedMarketRules(data.data);
          console.log(`[useTradingBot - ${networkType}] fetchMarketRules: Reglas almacenadas para ${selectedMarket.symbol}:`, data.data);
        } else {
          const errorMsg = data.message || `Error HTTP: ${response.status}`;
          console.error(`[useTradingBot - ${networkType}] fetchMarketRules: Error al obtener reglas para ${selectedMarket.symbol}: ${errorMsg}`, data);
          setSelectedMarketRules(null);
          toast({
            title: `Error al Cargar Reglas (${networkType})`,
            description: `No se pudieron obtener las reglas para ${selectedMarket.symbol}. ${errorMsg}`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error(`[useTradingBot - ${networkType}] fetchMarketRules: Excepción en fetch para ${selectedMarket.symbol}:`, error);
        setSelectedMarketRules(null);
        toast({
          title: `Error de Conexión (${networkType})`,
          description: `No se pudo conectar para obtener reglas de ${selectedMarket.symbol}. ${error.message}`,
          variant: "destructive",
        });
      }
    };

    if (selectedMarket) {
      fetchMarketRules();
    } else {
      setSelectedMarketRules(null); // Limpiar reglas si no hay mercado seleccionado
      // console.log(`[useTradingBot - ${useTestnet ? 'Testnet' : 'Mainnet'}] fetchMarketRules: No market selected, clearing market rules.`); // Log original
    }
  }, [selectedMarket, useTestnet, toast]);


  const executeBotStrategy = useCallback(async () => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';

    if (!isBotRunning) {
      // console.log(`[Bot Strategy - ${networkType}] Bot no está corriendo. Saliendo.`); // Log original
      return;
    }

    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20 || !selectedMarketRules) {
      console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes para ejecutar. Mercado: ${!!selectedMarket}, Precio: ${currentPrice}, Historial: ${currentMarketPriceHistory.length}, Reglas: ${!!selectedMarketRules}`);
      if (!selectedMarketRules) {
        console.warn(`[Bot Strategy - ${networkType}] Causa principal: Reglas del mercado (selectedMarketRules) no cargadas.`);
      }
      return;
    }

    if (Date.now() - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      // console.log(`[Bot Strategy - ${networkType}] Esperando intervalo mínimo entre acciones.`); // Log original
      return;
    }

    console.log(`[Bot Strategy - ${networkType}] Analizando ${selectedMarket.name} a precio: ${currentPrice}`);
    // console.log(`[Bot Strategy - ${networkType}] Historial:`, currentMarketPriceHistory.map(p => p.price)); // Log original, puede ser muy verboso
    // console.log(`[Bot Strategy - ${networkType}] Reglas disponibles:`, selectedMarketRules); // Log original


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
        // console.log(`[Bot Strategy - SMA - ${networkType}] SMA10: ${latestPriceDataPoint.sma10}, SMA20: ${latestPriceDataPoint.sma20}. Prev SMA10: ${previousPriceDataPoint.sma10}, Prev SMA20: ${previousPriceDataPoint.sma20}.`); // Log original
    } else {
        // console.log(`[Bot Strategy - SMA - ${networkType}] Datos SMA insuficientes.`); // Log original
    }

    if (action === 'hold' && latestPriceDataPoint.macdHistogram !== undefined && previousPriceDataPoint.macdHistogram !== undefined) {
        // console.log(`[Bot Strategy - MACD - ${networkType}] Hist: ${latestPriceDataPoint.macdHistogram}, Prev Hist: ${previousPriceDataPoint.macdHistogram}.`); // Log original
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "MACD Histograma Positivo";
      } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "MACD Histograma Negativo";
      }
    } else {
        // console.log(`[Bot Strategy - MACD - ${networkType}] Datos MACD insuficientes o SMA ya activó.`); // Log original
    }

    console.log(`[Bot Decision - ${networkType}] ${selectedMarket.symbol}: ${action.toUpperCase()} por: ${triggerReason}`);

    if (action !== 'hold') {
      let tradeAmount = 0;
      const marketRules = selectedMarketRules; // Usar las reglas cargadas

      if (action === 'buy' && allBinanceBalances && allBinanceBalances[selectedMarket.quoteAsset]) {
        const availableQuote = allBinanceBalances[selectedMarket.quoteAsset].available;
        const investmentPercentage = 0.05; 
        let desiredQuoteAmount = availableQuote * investmentPercentage;
        console.log(`[Bot Action - Buy - ${networkType}] Balance ${selectedMarket.quoteAsset}: ${availableQuote}. Inversión deseada (${investmentPercentage*100}%): ${desiredQuoteAmount} ${selectedMarket.quoteAsset}.`);

        tradeAmount = desiredQuoteAmount / currentPrice;
        console.log(`[Bot Action - Buy - ${networkType}] Cantidad base inicial: ${tradeAmount} ${selectedMarket.baseAsset}.`);

        if (!marketRules.limits || !marketRules.precision) {
             console.error(`[Bot Action - Buy - ${networkType}] Reglas de exchange incompletas para ${selectedMarket.symbol}. No se puede validar orden.`);
             return; 
        }
        const minNotional = parseFloat(marketRules.limits.cost.min);
        const minQty = parseFloat(marketRules.limits.amount.min);
        const stepSize = parseFloat(marketRules.precision.amount);
        console.log(`[Bot Action - Buy - ${networkType}] Reglas: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);

        if (tradeAmount * currentPrice < minNotional) {
            console.warn(`[Bot Action - Buy - ${networkType}] Nominal (${(tradeAmount * currentPrice).toFixed(selectedMarket.quotePrecision || 2)}) < minNotional. Ajustando...`);
            tradeAmount = minNotional / currentPrice; 
            console.log(`[Bot Action - Buy - ${networkType}] tradeAmount ajustado para minNotional: ${tradeAmount}`);
        }
        if (stepSize > 0) {
            tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
            tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || selectedMarket.quotePrecision || 6));
            console.log(`[Bot Action - Buy - ${networkType}] tradeAmount ajustado a stepSize (${stepSize}): ${tradeAmount}.`);
        }
        if (tradeAmount < minQty) {
             console.warn(`[Bot Action - Buy - ${networkType}] Cantidad base (${tradeAmount}) < minQty (${minQty}). Abortando.`);
             return; 
        }
        if (tradeAmount <= 0) {
             console.warn(`[Bot Action - Buy - ${networkType}] Cantidad base ajustada <= 0. Abortando.`);
             return;
        }
        console.log(`[Bot Action - Buy - ${networkType}] Cantidad final de compra: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      } else if (action === 'sell' && botOpenPosition && allBinanceBalances && allBinanceBalances[selectedMarket.baseAsset]) {
        const availableBase = allBinanceBalances[selectedMarket.baseAsset].available;
        console.log(`[Bot Action - Sell - ${networkType}] Posición abierta: ${botOpenPosition.amount}, Balance ${selectedMarket.baseAsset}: ${availableBase}.`);
        
        if (availableBase >= botOpenPosition.amount) {
            tradeAmount = botOpenPosition.amount;
            console.log(`[Bot Action - Sell - ${networkType}] Intentando vender la posición completa: ${tradeAmount} ${selectedMarket.baseAsset}.`);

            if (!marketRules.limits || !marketRules.precision) {
                console.error(`[Bot Action - Sell - ${networkType}] Reglas de exchange incompletas para ${selectedMarket.symbol}. No se puede validar orden.`);
                return;
            }
            const minQty = parseFloat(marketRules.limits.amount.min);
            const stepSize = parseFloat(marketRules.precision.amount);
            const minNotional = parseFloat(marketRules.limits.cost.min);
            console.log(`[Bot Action - Sell - ${networkType}] Reglas: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);

            if (stepSize > 0) {
                tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
                tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || selectedMarket.quotePrecision || 6));
                console.log(`[Bot Action - Sell - ${networkType}] tradeAmount ajustado a stepSize (${stepSize}): ${tradeAmount}.`);
            }
            if (tradeAmount < minQty) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Cantidad base (${tradeAmount}) < minQty (${minQty}). Abortando.`);
                 setBotOpenPosition(null);
                 return; 
            }
            if (tradeAmount * currentPrice < minNotional) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Nominal de venta (${(tradeAmount * currentPrice).toFixed(selectedMarket.quotePrecision || 2)}) < minNotional (${minNotional}). Abortando.`);
                 setBotOpenPosition(null);
                 return;
            }
            if (tradeAmount <= 0) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Cantidad base ajustada <= 0. Abortando.`);
                 setBotOpenPosition(null);
                 return;
            }
            console.log(`[Bot Action - Sell - ${networkType}] Cantidad final de venta: ${tradeAmount} ${selectedMarket.baseAsset}.`);
        } else {
            console.warn(`[Bot Action - Sell - ${networkType}] Balance ${selectedMarket.baseAsset} (${availableBase}) insuficiente para cerrar posición de ${botOpenPosition.amount}.`);
            setBotOpenPosition(null);
            return; 
        }
      } else {
          console.warn(`[Bot Action - ${networkType}] Condiciones no cumplidas para ${action} (balance/posición).`);
          return;
      }

      if (tradeAmount <= 0) {
        console.warn(`[Bot Action - ${networkType}] Cantidad final de trade <= 0 para ${action} ${selectedMarket.symbol}. Saltando orden.`);
        return;
      }

      setIsPlacingOrder(true);
      setPlaceOrderError(null);

      const orderData = {
        symbol: selectedMarket.symbol, 
        type: 'market', 
        side: action,
        amount: tradeAmount,
        price: currentPrice,
      };

      const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';
      console.log(`[useTradingBot - ${networkType}] Bot llamando a endpoint: ${endpoint} con datos:`, orderData);

      let tradeResult: any = null;

      try {
           const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
           });
           tradeResult = await response.json();
           console.log(`[useTradingBot - ${networkType}] Respuesta del endpoint ${endpoint} (Estado: ${response.status}):`, tradeResult);

           if (!response.ok || !tradeResult.success) {
               const errorDetail = tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`;
               console.error(`[useTradingBot - ${networkType}] Endpoint ${endpoint} reportó error:`, errorDetail);
               setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
               toast({
                 title: `Bot: Error al Colocar Orden (${networkType})`,
                 description: `Problema con ${selectedMarket?.symbol}: ${errorDetail}`,
                 variant: "destructive",
               });
           } else {
               console.log(`[useTradingBot - ${networkType}] Orden del bot colocada con éxito. ID: ${tradeResult.orderId}`);
               setBotLastActionTimestamp(Date.now());
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });
               
               if (action === 'buy') {
                   setBotOpenPosition({
                       marketId: selectedMarket.id,
                       entryPrice: tradeResult.price || currentPrice, 
                       amount: tradeResult.executedQty || tradeResult.amount,
                       type: 'buy',
                       timestamp: Math.floor(tradeResult.transactTime / 1000) || Math.floor(Date.now() / 1000)
                   });
                   toast({
                     title: `Bot: Compra Ejecutada (${networkType})`,
                     description: `${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
                     variant: "default",
                   });
               } else if (action === 'sell') {
                   if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                       const exitPrice = tradeResult.price || currentPrice;
                       const pnl = (exitPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
                       console.log(`[useTradingBot - ${networkType}] PnL simulado: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`);
                   }
                   setBotOpenPosition(null);
                   toast({
                     title: `Bot: Venta Ejecutada (${networkType})`,
                     description: `${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
                     variant: "default",
                   });
               }
           }
      } catch (fetchError: any) {
           console.error(`[useTradingBot - ${networkType}] Excepción en fetch al endpoint ${endpoint}:`, fetchError);
           const errorDetails = { message: `Error de red al colocar orden en ${networkType}.`, details: fetchError.message };
           setPlaceOrderError(errorDetails);
           if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });
           toast({
             title: `Bot: Error Crítico (${networkType})`,
             description: `No se pudo comunicar con el servidor para ${selectedMarket?.symbol}. ${errorDetails.details}`,
             variant: "destructive",
           });
      } finally {
          setIsPlacingOrder(false);
      }
    }
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
    selectedMarketRules // Asegúrate de que selectedMarketRules esté en las dependencias
  ]);

  // Efecto para controlar el ciclo de vida del bot
  useEffect(() => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot - ${networkType}] Efecto ciclo de vida. isBotRunning: ${isBotRunning}, selectedMarket: ${selectedMarket?.symbol}, reglasCargadas: ${!!selectedMarketRules}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket && selectedMarketRules) {
      console.log(`[useTradingBot - ${networkType}] Iniciando bot para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) clearInterval(botIntervalRef.current);
      
      executeBotStrategy(); // Ejecución inmediata
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId;
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot - ${networkType}] Deteniendo bot o condiciones no cumplidas. Limpiando intervalo.`);
        if (!selectedMarket) console.log(`[useTradingBot - ${networkType}] Razón: No hay mercado seleccionado.`);
        if (!selectedMarketRules) console.log(`[useTradingBot - ${networkType}] Razón: Reglas del mercado no cargadas.`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
        // console.log(`[useTradingBot - ${networkType}] Bot detenido o condiciones no cumplidas. No había intervalo activo.`); // Log original
      }
    }
    return () => {
      // console.log(`[useTradingBot - ${networkType}] Limpieza efecto ciclo de vida.`); // Log original
      if (intervalId) clearInterval(intervalId);
      if (botIntervalRef.current) { // Limpieza adicional por si acaso
          clearInterval(botIntervalRef.current);
          botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet, selectedMarketRules]); // selectedMarketRules es dependencia


  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      const networkType = useTestnet ? 'Testnet' : 'Mainnet';
      // console.log(`[useTradingBot - ${networkType}] toggleBotStatus: Nuevo estado -> ${newStatus}`); // Log original
      setTimeout(() => {
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"} (${networkType})`,
          description: `Bot para ${selectedMarket?.symbol || 'mercado'} ahora ${newStatus ? "activo" : "inactivo"}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast, selectedMarket, useTestnet]);

  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder,
    placeOrderError,
  };
};
