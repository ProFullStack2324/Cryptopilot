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
  placeOrderError: any; // Estado para errores al colocar orden
}

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  botIntervalMs = 15000, // Valor por defecto: cada 15 segundos
  useTestnet = false, // Valor por defecto para la nueva prop
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

  const BOT_MIN_ACTION_INTERVAL_MS = 5000; // Mínimo 5 segundos entre acciones reales del bot

  // Log inicial para props
  useEffect(() => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot - ${networkType}] Hook initialized/updated. Props:`, { selectedMarket: selectedMarket?.symbol, currentPrice, useTestnet, botIntervalMs });
  }, [selectedMarket, currentPrice, useTestnet, botIntervalMs]);


  // Efecto para cargar las reglas del mercado (exchange info)
  useEffect(() => {
    const fetchMarketRules = async () => {
      if (!selectedMarket) {
        const networkTypePrev = useTestnet ? 'Testnet' : 'Mainnet'; // Para log si selectedMarket era null
        console.log(`[useTradingBot - ${networkTypePrev}] fetchMarketRules: selectedMarket es nulo. Limpiando reglas.`);
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
          const errorDetails = data.details || ""; 
          console.error(`[useTradingBot - ${networkType}] fetchMarketRules: Error al obtener reglas para ${selectedMarket.symbol}: ${errorMsg}${errorDetails ? ` - Detalle Backend: ${errorDetails}`: ''}`, data);
          setSelectedMarketRules(null);
          toast({
            title: `Error al Cargar Reglas (${networkType})`,
            description: `No se pudieron obtener las reglas para ${selectedMarket.symbol}. ${errorMsg}${errorDetails ? ` Detalle: ${errorDetails}` : ''}`,
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
      setSelectedMarketRules(null); 
      const networkTypeCurrent = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot - ${networkTypeCurrent}] fetchMarketRules: No market selected, clearing market rules.`);
    }
  }, [selectedMarket, useTestnet, toast]); 


  const executeBotStrategy = useCallback(async () => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';

    if (!isBotRunning) {
      console.log(`[Bot Strategy - ${networkType}] Bot no está corriendo. Saliendo de executeBotStrategy.`);
      return;
    }

    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20 || !selectedMarketRules) {
      console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes (mercado, precio, historial o reglas) para ejecutar la estrategia.`);
      if (!selectedMarket) console.warn(`[Bot Strategy - ${networkType}] Razón: Mercado no seleccionado.`);
      if (!currentPrice || currentPrice <= 0) console.warn(`[Bot Strategy - ${networkType}] Razón: Precio actual inválido (${currentPrice}).`);
      if (currentMarketPriceHistory.length < 20) console.warn(`[Bot Strategy - ${networkType}] Razón: Historial de precios insuficiente (${currentMarketPriceHistory.length} puntos).`);
      if (!selectedMarketRules) {
           console.warn(`[Bot Strategy - ${networkType}] Razón: Reglas del mercado no cargadas. No se puede proceder.`);
      }
      return;
    }

    if (Date.now() - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy - ${networkType}] Esperando intervalo mínimo entre acciones.`);
      return;
    }

    console.log(`[Bot Strategy - ${networkType}] Analizando ${selectedMarket.name} a precio: ${currentPrice}. Reglas:`, selectedMarketRules);


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
    }

    if (action === 'hold' && latestPriceDataPoint.macdHistogram !== undefined && previousPriceDataPoint.macdHistogram !== undefined) {
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "MACD Histograma Positivo";
      } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "MACD Histograma Negativo";
      }
    }

    console.log(`[Bot Decision - ${networkType}] ${selectedMarket.symbol}: Acción decidida: ${action.toUpperCase()} por: ${triggerReason}`);

    if (action !== 'hold') {
      let tradeAmount = 0;
      const marketRules = selectedMarketRules; 

      if (action === 'buy' && allBinanceBalances && allBinanceBalances[selectedMarket.quoteAsset]) {
        const availableQuote = allBinanceBalances[selectedMarket.quoteAsset].available;
        const investmentPercentage = 0.05; 
        let desiredQuoteAmount = availableQuote * investmentPercentage;
        console.log(`[Bot Action - Buy - ${networkType}] Balance ${selectedMarket.quoteAsset}: ${availableQuote}. Inversión deseada (${investmentPercentage*100}%): ${desiredQuoteAmount} ${selectedMarket.quoteAsset}.`);

        tradeAmount = desiredQuoteAmount / currentPrice;
        console.log(`[Bot Action - Buy - ${networkType}] Cantidad base inicial (antes de aplicar reglas): ${tradeAmount} ${selectedMarket.baseAsset}.`);

        if (!marketRules || !marketRules.limits || !marketRules.precision) {
             console.error(`[Bot Action - Buy - ${networkType}] Reglas de exchange incompletas para ${selectedMarket.symbol}. No se puede validar orden. Reglas:`, marketRules);
             return; 
        }
        const minNotional = parseFloat(marketRules.limits.cost?.min); 
        const minQty = parseFloat(marketRules.limits.amount?.min);   
        const stepSize = parseFloat(marketRules.precision?.amount); 

        if (isNaN(minNotional) || isNaN(minQty) || isNaN(stepSize)) {
            console.error(`[Bot Action - Buy - ${networkType}] Una o más reglas (minNotional, minQty, stepSize) son NaN. No se puede validar orden. Reglas:`, marketRules);
            return;
        }
        console.log(`[Bot Action - Buy - ${networkType}] Reglas aplicables: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);

        if (tradeAmount * currentPrice < minNotional) {
            console.warn(`[Bot Action - Buy - ${networkType}] Nominal (${(tradeAmount * currentPrice).toFixed(selectedMarket.pricePrecision || 2)}) < minNotional (${minNotional}). Ajustando cantidad para cumplir minNotional...`);
            tradeAmount = (minNotional / currentPrice) * 1.01; 
            console.log(`[Bot Action - Buy - ${networkType}] tradeAmount ajustado para minNotional: ${tradeAmount}`);
        }
        if (stepSize > 0) {
            tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
            tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || 8)); 
            console.log(`[Bot Action - Buy - ${networkType}] tradeAmount ajustado a stepSize (${stepSize}) y precisión: ${tradeAmount}.`);
        }
        if (tradeAmount < minQty) {
             console.warn(`[Bot Action - Buy - ${networkType}] Cantidad base ajustada (${tradeAmount}) < minQty (${minQty}). Abortando orden de compra.`);
             return; 
        }
        if (tradeAmount <= 0) {
             console.warn(`[Bot Action - Buy - ${networkType}] Cantidad base ajustada es <= 0 (${tradeAmount}). Abortando orden de compra.`);
             return;
        }
        console.log(`[Bot Action - Buy - ${networkType}] Cantidad final de compra: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      } else if (action === 'sell' && botOpenPosition && allBinanceBalances && allBinanceBalances[selectedMarket.baseAsset]) {
        const availableBase = allBinanceBalances[selectedMarket.baseAsset].available;
        console.log(`[Bot Action - Sell - ${networkType}] Posición abierta: ${botOpenPosition.amount}, Balance ${selectedMarket.baseAsset}: ${availableBase}.`);
        
        if (availableBase >= botOpenPosition.amount) { 
            tradeAmount = botOpenPosition.amount;
            console.log(`[Bot Action - Sell - ${networkType}] Intentando vender la posición completa: ${tradeAmount} ${selectedMarket.baseAsset}.`);

            if (!marketRules || !marketRules.limits || !marketRules.precision) {
                console.error(`[Bot Action - Sell - ${networkType}] Reglas de exchange incompletas para ${selectedMarket.symbol}. No se puede validar orden. Reglas:`, marketRules);
                return;
            }
            const minQty = parseFloat(marketRules.limits.amount?.min);
            const stepSize = parseFloat(marketRules.precision?.amount);
            const minNotional = parseFloat(marketRules.limits.cost?.min);

            if (isNaN(minNotional) || isNaN(minQty) || isNaN(stepSize)) {
                console.error(`[Bot Action - Sell - ${networkType}] Una o más reglas (minNotional, minQty, stepSize) son NaN. No se puede validar orden. Reglas:`, marketRules);
                return;
            }
            console.log(`[Bot Action - Sell - ${networkType}] Reglas aplicables: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);

            if (stepSize > 0) {
                tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
                 tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || 8));
                console.log(`[Bot Action - Sell - ${networkType}] tradeAmount ajustado a stepSize (${stepSize}) y precisión: ${tradeAmount}.`);
            }
            if (tradeAmount < minQty) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Cantidad base ajustada (${tradeAmount}) < minQty (${minQty}). Abortando orden de venta.`);
                 setBotOpenPosition(null); 
                 return; 
            }
            if (tradeAmount * currentPrice < minNotional) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Nominal de venta (${(tradeAmount * currentPrice).toFixed(selectedMarket.pricePrecision || 2)}) < minNotional (${minNotional}). Abortando orden de venta.`);
                 setBotOpenPosition(null);
                 return;
            }
            if (tradeAmount <= 0) {
                 console.warn(`[Bot Action - Sell - ${networkType}] Cantidad base ajustada es <= 0 (${tradeAmount}). Abortando orden de venta.`);
                 setBotOpenPosition(null);
                 return;
            }
            console.log(`[Bot Action - Sell - ${networkType}] Cantidad final de venta: ${tradeAmount} ${selectedMarket.baseAsset}.`);
        } else {
            console.warn(`[Bot Action - Sell - ${networkType}] Balance ${selectedMarket.baseAsset} (${availableBase}) insuficiente para cerrar posición simulada de ${botOpenPosition.amount}. La posición simulada puede estar desincronizada.`);
            setBotOpenPosition(null); 
            return; 
        }
      } else {
          console.warn(`[Bot Action - ${networkType}] Condiciones no cumplidas para ${action} (balance/posición). Acción: ${action}, Posición: ${botOpenPosition ? botOpenPosition.amount : 'ninguna'}, Balances: ${allBinanceBalances ? 'cargados' : 'no cargados'}`);
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
      console.log(`[useTradingBot - ${networkType}] Bot llamando al endpoint: ${endpoint} con datos:`, orderData);

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
               const errorDetailBackend = tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`;
               console.error(`[useTradingBot - ${networkType}] Endpoint ${endpoint} reportó error: ${errorDetailBackend}`);
               setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
               toast({
                 title: `Bot: Error al Colocar Orden (${networkType})`,
                 description: `Problema con ${selectedMarket?.symbol}: ${errorDetailBackend}`,
                 variant: "destructive",
               });
           } else {
               console.log(`[useTradingBot - ${networkType}] Orden del bot colocada con éxito. ID: ${tradeResult.orderId}, Estado: ${tradeResult.status}`);
               setBotLastActionTimestamp(Date.now());
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });
               
               if (action === 'buy') {
                   setBotOpenPosition({
                       marketId: selectedMarket.id,
                       entryPrice: parseFloat(tradeResult.price) || currentPrice, 
                       amount: parseFloat(tradeResult.executedQty || tradeResult.fills?.[0]?.qty || tradeResult.amount),
                       type: 'buy',
                       timestamp: Math.floor((tradeResult.transactTime || Date.now()) / 1000)
                   });
                   toast({
                     title: `Bot: Compra Ejecutada (${networkType})`,
                     description: `${parseFloat(tradeResult.executedQty || tradeResult.fills?.[0]?.qty || tradeResult.amount)} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
                     variant: "default",
                   });
               } else if (action === 'sell') {
                   if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                       const exitPrice = parseFloat(tradeResult.price) || currentPrice;
                       const pnl = (exitPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
                       console.log(`[useTradingBot - ${networkType}] PnL simulado: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`);
                   }
                   setBotOpenPosition(null);
                   toast({
                     title: `Bot: Venta Ejecutada (${networkType})`,
                     description: `${parseFloat(tradeResult.executedQty || tradeResult.fills?.[0]?.qty || tradeResult.amount)} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`,
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
    selectedMarketRules 
  ]);

  // Efecto para controlar el ciclo de vida del bot
  useEffect(() => {
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot - ${networkType}] Efecto ciclo de vida. isBotRunning: ${isBotRunning}, selectedMarket: ${selectedMarket?.symbol}, reglasCargadas: ${!!selectedMarketRules}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket && selectedMarketRules) { 
      console.log(`[useTradingBot - ${networkType}] Iniciando bot para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) clearInterval(botIntervalRef.current); 
      
      executeBotStrategy(); 
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId;
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot - ${networkType}] Deteniendo bot o condiciones no cumplidas. Limpiando intervalo.`);
        if (!selectedMarket) console.log(`[useTradingBot - ${networkType}] Razón para detener/no iniciar: No hay mercado seleccionado.`);
        if (!selectedMarketRules) console.log(`[useTradingBot - ${networkType}] Razón para detener/no iniciar: Reglas del mercado no cargadas.`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
         console.log(`[useTradingBot - ${networkType}] Bot detenido o condiciones no cumplidas. No había intervalo activo.`);
      }
    }
    return () => {
      console.log(`[useTradingBot - ${networkType}] Limpieza efecto ciclo de vida (desmontaje o cambio de dependencias).`);
      if (intervalId) clearInterval(intervalId); 
      if (botIntervalRef.current) { 
          clearInterval(botIntervalRef.current);
          botIntervalRef.current = null;
           console.log(`[useTradingBot - ${networkType}] Referencia de intervalo botIntervalRef limpiada.`);
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet, selectedMarketRules]); 


  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      const networkType = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot - ${networkType}] toggleBotStatus: Nuevo estado del bot -> ${newStatus}`);
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
