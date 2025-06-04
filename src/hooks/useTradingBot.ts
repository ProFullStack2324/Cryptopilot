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
  useTestnet?: boolean; // *** Prop para indicar si el bot debe operar en la red de prueba ***
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
  useTestnet = false, // *** Valor por defecto para la prop useTestnet ***
  onBotAction, 
}: UseTradingBotProps): UseTradingBotReturn => {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<any>(null);
  
  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

// --- Lógica principal de la estrategia del bot ---
const executeBotStrategy = useCallback(async () => {
    // *** Determinar la red (Mainnet/Testnet) basado en la prop useTestnet ***
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    
    if (!isBotRunning) { 
         console.log("[Bot Strategy] Bot no está corriendo. Saliendo de executeBotStrategy.");
         return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20) {
      console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes para ejecutar la estrategia para ${selectedMarket?.name || 'mercado desconocido'}. Necesita historial y precio actual.`);
      return;
    }

    if (Date.now() - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy - ${networkType}] Esperando intervalo mínimo entre acciones.`);
      return;
    }

    console.log(`[Bot Strategy - ${networkType}] Analizando ${selectedMarket.name} a precio: ${currentPrice}. Historial puntos: ${currentMarketPriceHistory.length}`);


    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2]; 

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    // --- Estrategia de Cruce de SMA (ejemplo) ---
    if (latestPriceDataPoint?.sma10 !== undefined && latestPriceDataPoint?.sma20 !== undefined &&
        previousPriceDataPoint?.sma10 !== undefined && previousPriceDataPoint?.sma20 !== undefined) {
        if (latestPriceDataPoint.sma10 > latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 <= previousPriceDataPoint.sma20) {
            action = 'buy';
            triggerReason = "Cruce SMA Alcista (10 > 20)";
        } else if (latestPriceDataPoint.sma10 < latestPriceDataPoint.sma20 && previousPriceDataPoint.sma10 >= previousPriceDataPoint.sma20) {
            action = 'sell';
            triggerReason = "Cruce SMA Bajista (10 < 20)";
        }
    } else {
        console.log(`[Bot Strategy - SMA - ${networkType}] Datos de SMA insuficientes o no calculados.`);
    }

    // --- Estrategia de MACD (ejemplo) ---
    if (action === 'hold' && latestPriceDataPoint?.macdHistogram !== undefined && previousPriceDataPoint?.macdHistogram !== undefined) {
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "MACD Histograma Positivo";
      } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "MACD Histograma Negativo";
      }
    } else {
         console.log(`[Bot Strategy - MACD - ${networkType}] Datos de MACD insuficientes o SMA ya activó una acción.`);
    }

    console.log(`[Bot Decision - ${networkType}] ${selectedMarket.symbol}: Acción: ${action.toUpperCase()}. Razón: ${triggerReason}`);

    if (action !== 'hold') {
      let tradeAmount = 0;
      
      // Determinar cantidad a operar
      if (action === 'buy' && allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.quoteAsset]) {
        const availableQuote = allBinanceBalances[selectedMarket.quoteAsset].available;
        const investmentPercentage = 0.05; // Invertir 5% del balance de quoteAsset
        const desiredQuoteAmount = availableQuote * investmentPercentage;
        
        // Validar contra minNotional (monto mínimo de la orden en quoteAsset)
        if (selectedMarket.minNotional && desiredQuoteAmount < selectedMarket.minNotional) {
            console.warn(`[Bot Action - Buy - ${networkType}] Monto deseado ${desiredQuoteAmount} ${selectedMarket.quoteAsset} es menor que minNotional ${selectedMarket.minNotional}. Ajustando a minNotional.`);
            // No podemos operar por debajo del minNotional. Podríamos ajustar o no operar.
            // Por ahora, no operaremos si es menor. En un bot real, se podría ajustar.
             toast({ title: `Bot: Monto Bajo (Compra ${networkType})`, description: `Intento de compra por ${desiredQuoteAmount.toFixed(2)} ${selectedMarket.quoteAsset} no cumple el mínimo de ${selectedMarket.minNotional}.`, variant: "destructive", duration: 7000 });
            return; // Salir si no cumple el mínimo
        }

        tradeAmount = parseFloat((desiredQuoteAmount / currentPrice).toFixed(selectedMarket.amountPrecision || 6));

        // Validar contra minQty (cantidad mínima del baseAsset)
        if (selectedMarket.minQty && tradeAmount < selectedMarket.minQty) {
            console.warn(`[Bot Action - Buy - ${networkType}] Cantidad calculada ${tradeAmount} ${selectedMarket.baseAsset} es menor que minQty ${selectedMarket.minQty}.`);
            toast({ title: `Bot: Cantidad Baja (Compra ${networkType})`, description: `Intento de compra por ${tradeAmount.toFixed(selectedMarket.amountPrecision || 6)} ${selectedMarket.baseAsset} no cumple la cantidad mínima de ${selectedMarket.minQty}.`, variant: "destructive", duration: 7000 });
            return; // Salir si no cumple el mínimo
        }

      } else if (action === 'sell' && allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.baseAsset]) {
        const availableBase = allBinanceBalances[selectedMarket.baseAsset].available;
        const sellPercentage = 1.0; // Vender 100% del balance disponible del baseAsset
        tradeAmount = parseFloat((availableBase * sellPercentage).toFixed(selectedMarket.amountPrecision || 6));

        // Validar contra minQty (cantidad mínima del baseAsset)
        if (selectedMarket.minQty && tradeAmount < selectedMarket.minQty) {
            console.warn(`[Bot Action - Sell - ${networkType}] Cantidad disponible ${tradeAmount} ${selectedMarket.baseAsset} es menor que minQty ${selectedMarket.minQty}.`);
            toast({ title: `Bot: Cantidad Baja (Venta ${networkType})`, description: `Intento de venta por ${tradeAmount.toFixed(selectedMarket.amountPrecision || 6)} ${selectedMarket.baseAsset} no cumple la cantidad mínima de ${selectedMarket.minQty}.`, variant: "destructive", duration: 7000 });
            return; // Salir si no cumple el mínimo
        }
        // Validar contra minNotional (el valor de la venta en quoteAsset)
        const estimatedSellValue = tradeAmount * currentPrice;
        if (selectedMarket.minNotional && estimatedSellValue < selectedMarket.minNotional) {
            console.warn(`[Bot Action - Sell - ${networkType}] Valor estimado de venta ${estimatedSellValue} ${selectedMarket.quoteAsset} es menor que minNotional ${selectedMarket.minNotional}.`);
            toast({ title: `Bot: Monto Bajo (Venta ${networkType})`, description: `Intento de venta por valor de ${estimatedSellValue.toFixed(2)} ${selectedMarket.quoteAsset} no cumple el mínimo de ${selectedMarket.minNotional}.`, variant: "destructive", duration: 7000 });
            return;
        }


      } else {
          console.warn(`[Bot Action - ${networkType}] No hay balances o mercado para calcular tradeAmount.`);
          return; 
      }

      if (tradeAmount <= 0) {
        console.warn(`[Bot Action - ${networkType}] Cantidad de trade calculada es <= 0 para ${action} ${selectedMarket.symbol}. Saltando orden.`);
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

      // *** Seleccionar el endpoint de API correcto (Mainnet o Testnet) ***
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
           console.log(`[useTradingBot - ${networkType}] Respuesta de orden del bot:`, tradeResult);

           if (!response.ok || !tradeResult.success) {
               const errorMsg = tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`;
               console.error(`[useTradingBot - ${networkType}] Endpoint ${endpoint} reportó error: ${errorMsg}`);
               setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
               toast({ title: `Bot: Error Orden (${networkType})`, description: `Error al colocar orden en ${selectedMarket?.symbol}: ${errorMsg}`, variant: "destructive" });
           } else {
               console.log(`[useTradingBot - ${networkType}] Orden del bot exitosa. ID: ${tradeResult.orderId}`);
               setBotLastActionTimestamp(Date.now()); 
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });
               
               // Actualización de Posición Simulada del Bot
               if (action === 'buy') {
                   setBotOpenPosition({
                       marketId: selectedMarket.id,
                       entryPrice: tradeResult.price || currentPrice, 
                       amount: tradeResult.executedQty || tradeResult.amount, 
                       type: 'buy',
                       timestamp: Math.floor((tradeResult.transactTime || Date.now()) / 1000) 
                   });
                   toast({ title: `Bot: Compra Ejecutada (${networkType})`, description: `Orden de ${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`, variant: "default" });
               } else if (action === 'sell') {
                    if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                        const exitPrice = tradeResult.price || currentPrice; 
                        const pnl = (exitPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
                        console.log(`[useTradingBot - ${networkType}] PnL simulado (cierre de posición): ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`);
                        toast({ title: `Bot: Posición Cerrada (${networkType})`, description: `P&L: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`, variant: "default" });
                    }
                   setBotOpenPosition(null); 
                   toast({ title: `Bot: Venta Ejecutada (${networkType})`, description: `Orden de ${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} en ${selectedMarket.symbol}.`, variant: "default" });
               }
           }
      } catch (fetchError: any) {
           const errorDetails = { message: `Error de red/inesperado (${networkType})`, details: fetchError.message };
           console.error(`[useTradingBot - ${networkType}] Error en fetch a ${endpoint}:`, fetchError);
           setPlaceOrderError(errorDetails);
           if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });
           toast({ title: `Bot: Error Conexión (${networkType})`, description: `No se pudo comunicar para orden en ${selectedMarket?.symbol}. Detalles: ${errorDetails.details}`, variant: "destructive" });
      } finally {
          setIsPlacingOrder(false); 
      }
    }
  }, [
    isBotRunning, selectedMarket, currentMarketPriceHistory, currentPrice,
    allBinanceBalances, botLastActionTimestamp, botOpenPosition,
    toast, useTestnet, onBotAction // *** useTestnet es dependencia ***
  ]);

  // Efecto para controlar el ciclo de vida del bot
  useEffect(() => {
    // *** Determinar la red (Mainnet/Testnet) basado en la prop useTestnet para logs ***
    const networkTypeLog = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot] Efecto ciclo de vida. isBotRunning: ${isBotRunning}, Mercado: ${selectedMarket?.symbol}, Red: ${networkTypeLog}`);
    
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket) { 
      console.log(`[useTradingBot] Bot iniciado para ${selectedMarket.symbol} en ${networkTypeLog}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
      }
      executeBotStrategy(); 
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId; 
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot] Bot detenido o sin mercado. Limpiando intervalo (${networkTypeLog}).`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    }
    return () => {
      console.log(`[useTradingBot] Limpieza efecto bot (${networkTypeLog}).`);
      if (intervalId) { 
         clearInterval(intervalId);
      }
       botIntervalRef.current = null; 
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet]); // *** useTestnet es dependencia ***


  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      // *** Determinar la red (Mainnet/Testnet) basado en la prop useTestnet para el toast ***
      const networkTypeToast = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot] toggleBotStatus. Nuevo estado: ${newStatus}. Red: ${networkTypeToast}`);
      
      setTimeout(() => { // Defer toast
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"}`,
          description: `Bot de trading ahora ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'mercado sel.'} en ${networkTypeToast}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast, selectedMarket, useTestnet]); // *** useTestnet es dependencia ***


  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder,
    placeOrderError,
  };
};
