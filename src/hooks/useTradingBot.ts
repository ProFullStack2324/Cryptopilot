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
// --- INICIO SECCIÓN MODIFICADA: Añadir prop para usar Testnet ---
interface UseTradingBotProps {
  selectedMarket: Market | null;
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null; // El precio actual más reciente
  allBinanceBalances: Record<string, FormattedBalance> | null;
  // Eliminamos o ajustamos onPlaceOrder si el bot manejará la colocación
  // onPlaceOrder: (orderData: OrderFormData, isBotOrder: boolean) => Promise<boolean>;
  botIntervalMs?: number; // Intervalo de ejecución del bot en ms
  useTestnet?: boolean; // Nuevo: Indica si el bot debe operar en la red de prueba
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void; // Opcional: Callback para notificar al UI
}
// --- FIN SECCIÓN MODIFICADA: Añadir prop para usar Testnet ---


interface UseTradingBotReturn {
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  botOpenPosition: SimulatedPosition | null;
  botLastActionTimestamp: number;
  // Puedes añadir estado de carga o error para la colocación de órdenes del bot si es necesario
  isPlacingOrder: boolean;
  placeOrderError: any; // Estado para errores al colocar orden
}

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  // Eliminamos onPlaceOrder de las props desestructuradas
  // onPlaceOrder,
  botIntervalMs = 15000, // Valor por defecto: cada 15 segundos
  useTestnet = false, // Valor por defecto para la nueva prop
  onBotAction, // Destructurar el nuevo callback opcional
}: UseTradingBotProps): UseTradingBotReturn => {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // --- NUEVOS ESTADOS para la colocación de órdenes dentro del bot ---
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<any>(null);
  // --- FIN NUEVOS ESTADOS ---


  // Mínimo 5 segundos entre acciones reales del bot para evitar spam de órdenes
  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

// --- Lógica principal de la estrategia del bot ---
const executeBotStrategy = useCallback(async () => {
    // --- CORRECCIÓN 1: Definir networkType ---
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    // --- FIN CORRECCIÓN 1 ---


    if (!isBotRunning) { // Añadir verificación por si el estado cambia rápidamente
         console.log("[Bot Strategy] Bot no está corriendo. Saliendo de executeBotStrategy.");
         return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20) {
      console.warn("[Bot Strategy] Datos insuficientes para ejecutar la estrategia.");
      return;
    }

    // Evitar acciones muy rápidas si el bot ya operó recientemente
    if (Date.now() - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log("[Bot Strategy] Esperando intervalo mínimo entre acciones.");
      return;
    }

    console.log(`[Bot Strategy] Analizando ${selectedMarket.name} a precio: ${currentPrice} en ${networkType}`); // networkType ahora definida
    console.log(`[Bot Strategy] Historial de precios actual:`, currentMarketPriceHistory.map(p => p.price));


    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2]; // Para cruces de SMA/MACD

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    // --- Estrategia de Cruce de SMA (ejemplo) ---
    // Requiere al menos 2 puntos para detectar un cruce
    if (latestPriceDataPoint.sma10 !== undefined && latestPriceDataPoint.sma20 !== undefined &&
        previousPriceDataPoint.sma10 !== undefined && previousPriceDataPoint.sma20 !== undefined) {

        // Cruce alcista: SMA10 cruza por encima de SMA20
        if (latestPriceDataPoint.sma10 > latestPriceDataPoint.sma20 &&
            previousPriceDataPoint.sma10 <= previousPriceDataPoint.sma20) {
            action = 'buy';
            triggerReason = "Cruce SMA Alcista";
        }
        // Cruce bajista: SMA10 cruza por debajo de SMA20
        else if (latestPriceDataPoint.sma10 < latestPriceDataPoint.sma20 &&
                 previousPriceDataPoint.sma10 >= previousPriceDataPoint.sma20) {
            action = 'sell';
            triggerReason = "Cruce SMA Bajista";
        }
        console.log(`[Bot Strategy - SMA] Última SMA10: ${latestPriceDataPoint.sma10}, Última SMA20: ${latestPriceDataPoint.sma20}. Previa SMA10: ${previousPriceDataPoint.sma10}, Previa SMA20: ${previousPriceDataPoint.sma20}.`);
    } else {
        console.log(`[Bot Strategy - SMA] Datos de SMA insuficientes. Saltando estrategia SMA.`);
    }

    // --- Estrategia de MACD (ejemplo) ---
    // Puedes añadir más lógica de decisión o combinar indicadores aquí
    if (action === 'hold' && latestPriceDataPoint.macdHistogram !== undefined &&
        previousPriceDataPoint.macdHistogram !== undefined) {
        console.log(`[Bot Strategy - MACD] Último Histograma: ${latestPriceDataPoint.macdHistogram}, Previo Histograma: ${previousPriceDataPoint.macdHistogram}.`);
      // Cambio de histograma de negativo a positivo (señal de compra)
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "MACD Histograma Positivo";
      }
      // Cambio de histograma de positivo a negativo (señal de venta)
      else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "MACD Histograma Negativo";
      }
    } else {
         console.log(`[Bot Strategy - MACD] Datos de MACD Histograma insuficientes o SMA ya triggereó. Saltando estrategia MACD.`);
    }


    console.log(`[Bot Decision] ${selectedMarket.symbol} (${networkType}): Acción decidida: ${action.toUpperCase()} por: ${triggerReason}`); // networkType ahora definida

    // --- Ejecutar la orden si se decide una acción ---
    if (action !== 'hold') {
      let tradeAmount = 0;
      // Determinar la cantidad a operar. Puedes usar un porcentaje de tu balance.
      // Aquí usamos el balance de quoteAsset (ej. USDT) para compras y baseAsset (ej. BTC) para ventas.

      // --- COMIENZO CORRECCIÓN PARA BUY ---
      if (action === 'buy' && allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.quoteAsset]) {
        // ELIMINAR la siguiente línea ya que availableBase no se usa aquí:
        // const availableBase = allBinanceBalances[selectedMarket.baseAsset].available;

        // AGREGAR la declaración de availableQuote:
        const availableQuote = allBinanceBalances[selectedMarket.quoteAsset].available; // available ya es un number

        const investmentPercentage = 0.05; // Ejemplo: Invertir 5% del balance disponible
        const desiredQuoteAmount = availableQuote * investmentPercentage;
         console.log(`[Bot Action - Buy] Balance disponible de ${selectedMarket.quoteAsset}: ${availableQuote}. Deseo invertir ${investmentPercentage*100}%, equivalente a ${desiredQuoteAmount} ${selectedMarket.quoteAsset}.`);

        // Asegurarse de no operar por debajo del mínimo nominal o de cantidad de Binance
        // Esto requeriría obtener las reglas de intercambio (minNotional, minQty, etc.)
        // Por ahora, solo calculamos la cantidad base en función del precio actual
        // IMPORTANTE: Necesitas obtener y aplicar las reglas de trading de Binance aquí!
        // Puedes obtenerlas del endpoint /api/binance/symbols o /api/binance/exchangeInfo
         // --- CORRECCIÓN 2: Usar quotePrecision (esta ya la tenías) ---
        tradeAmount = parseFloat((desiredQuoteAmount / currentPrice).toFixed(selectedMarket.amountPrecision || selectedMarket.quotePrecision || 6)); // Usar quotePrecision si amountPrecision no existe
         // --- FIN CORRECCIÓN 2 ---
         console.log(`[Bot Action - Buy] Precio actual: ${currentPrice}. Cantidad base calculada: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      // --- FIN COMIENZO CORRECCIÓN PARA BUY ---


      // --- COMIENZO CORRECCIÓN PARA SELL ---
      // NOTA: El else if para 'sell' parece estar bien en cuanto a la declaración de availableBase
      } else if (action === 'sell' && botOpenPosition && allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.baseAsset]) {
        // Si hay una posición abierta del bot para este mercado, intenta cerrarla completamente
        // También verificar si realmente tenemos la cantidad del activo base en balance

        // Mantener la declaración de availableBase aquí (esta línea parece correcta en tu original):
        const availableBase = allBinanceBalances[selectedMarket.baseAsset].available;

        if (availableBase >= botOpenPosition.amount) {
            tradeAmount = botOpenPosition.amount;
            console.log(`[Bot Action - Sell] Posición abierta: ${botOpenPosition.amount}. Balance disponible ${selectedMarket.baseAsset}: ${availableBase}. Intentando vender la posición completa: ${tradeAmount} ${selectedMarket.baseAsset}.`);
        } else {
            console.warn(`[Bot Action - Sell] Balance insuficiente de ${selectedMarket.baseAsset} (${availableBase}) para cerrar la posición abierta (${botOpenPosition.amount}). Saltando acción de venta.`);
            // No tenemos suficiente balance, no podemos cerrar la posición abierta simulada de forma real.
            return; // Salir de la función si no podemos vender
        }
      } else {
          console.warn(`[Bot Action] Condiciones no cumplidas para ejecutar ${action}.`);
          return; // Salir si no se cumplen las condiciones para comprar o vender (ej. falta balance, no hay posición para vender)
      }
       // --- FIN COMIENZO CORRECCIÓN PARA SELL ---


      if (tradeAmount <= 0) {
        console.warn(`[Bot Action] Cantidad de trade calculada fue <= 0 para ${action} ${selectedMarket.symbol}. Saltando colocación de orden.`);
        return;
      }

      // --- INICIO SECCIÓN MODIFICADA: Colocación de Orden a través de Endpoint de API ---
      setIsPlacingOrder(true); // Indicar que estamos colocando una orden
      setPlaceOrderError(null); // Limpiar error anterior

      const orderData = {
        symbol: selectedMarket.symbol, // Usar el símbolo directo (ej. BTCUSDT) que esperan los endpoints
        type: 'market', // Por ahora, solo órdenes de mercado para simplificar
        side: action,
        amount: tradeAmount,
        // price no es estrictamente necesario para órdenes de mercado, pero se puede incluir como referencia
        price: currentPrice, // Precio de referencia
      };

      // Determinar el endpoint correcto (mainnet o testnet)
      const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';
      console.log(`[useTradingBot] Bot llamando al endpoint de trade: ${endpoint} con datos:`, orderData);

      let tradeResult: any = null; // Usamos any por ahora, podrías usar la interfaz TradeResult si la exportas

      try {
           const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
           });

           console.log(`[useTradingBot] Respuesta del endpoint ${endpoint} recibida. Estado: ${response.status}`);
           tradeResult = await response.json();
           console.log(`[useTradingBot] Resultado de la orden del bot:`, tradeResult);

           if (!response.ok || !tradeResult.success) {
               console.error(`[useTradingBot] El endpoint ${endpoint} reportó un error o fallo en la operación.`);
               setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
               // Notificar al UI si hay un callback
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });

               // Mostrar toast de error
             toast({
               title: "Bot: Error al Colocar Orden",
               description: `Hubo un problema al intentar colocar la orden en ${selectedMarket?.symbol} en ${networkType}. Detalles: ${tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`}`, // Incluir más detalles del error si están disponibles
               variant: "destructive",
             });


           } else {
               console.log(`[useTradingBot] Orden del bot colocada con éxito en ${networkType}. Order ID: ${tradeResult.orderId}`);
               setBotLastActionTimestamp(Date.now()); // Actualizar timestamp solo si la orden fue exitosa

               // Notificar al UI si hay un callback
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

               // --- Actualización de Posición Simulada del Bot basada en el RESULTADO REAL ---
               if (action === 'buy') {
                   // Si la compra fue exitosa, establecer la nueva posición abierta
                    console.log("[useTradingBot] Actualizando posición simulada: Compra exitosa.");
                   setBotOpenPosition({
                       marketId: selectedMarket.id,
                       entryPrice: tradeResult.price || currentPrice, // Usar precio de ejecución si está disponible, fallback al precio actual
                       amount: tradeResult.executedQty || tradeResult.amount, // Usar cantidad ejecutada si está disponible, fallback a la cantidad solicitada
                       type: 'buy',
                       timestamp: Math.floor(tradeResult.transactTime / 1000) || Math.floor(Date.now() / 1000) // Usar timestamp de la transacción si está disponible
                   });
                    // Mostrar toast de éxito de compra
                    toast({
                      title: "Bot: Compra Ejecutada",
                      description: `Orden de ${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} colocada en ${selectedMarket.symbol} en ${networkType}.`, // Usar cantidad ejecutada en el mensaje si está disponible
                      variant: "default",
                    });

               } else if (action === 'sell') {
                   // Si la venta fue exitosa, cerrar la posición abierta simulada
                   console.log("[useTradingBot] Actualizando posición simulada: Venta exitosa.");
                   // Calcular PnL simulado si había una posición de compra abierta para este mercado
                    if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                        const exitPrice = tradeResult.price || currentPrice; // Usar precio de ejecución o actual
                        const pnl = (exitPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
                         console.log(`[useTradingBot] PnL simulado de la operación: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`); // Usar quotePrecision
                         // Aquí podrías guardar este PnL en un estado o historial si lo necesitas
                    }
                   setBotOpenPosition(null); // Cerrar la posición simulada

                    // Mostrar toast de éxito de venta
                    toast({
                      title: "Bot: Venta Ejecutada",
                      description: `Orden de ${tradeResult.executedQty || tradeResult.amount} ${selectedMarket.baseAsset} colocada en ${selectedMarket.symbol} en ${networkType}.`, // Usar cantidad ejecutada en el mensaje
                       variant: "default", // O una variante de éxito específica
                    });
               }
           }

      } catch (fetchError: any) {
           console.error(`[useTradingBot] Error en la llamada fetch al endpoint ${endpoint}:`, fetchError);
           const errorDetails = {
               message: `Error de red o inesperado al colocar orden en ${networkType}.`,
               details: fetchError.message,
           };
           setPlaceOrderError(errorDetails);
            // Notificar al UI si hay un callback
           if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });

            // Mostrar toast de error
             toast({
               title: "Bot: Error Crítico de Conexión",
               description: `No se pudo comunicar con el servidor para colocar la orden en ${selectedMarket?.symbol}. Detalles: ${errorDetails.details}`,
               variant: "destructive",
             });

      } finally {
          setIsPlacingOrder(false); // Finalizar estado de carga de colocación de orden
      }
      // --- FIN SECCIÓN MODIFICADA: Colocación de Orden a través de Endpoint de API ---
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
    onBotAction
  ]);

  // --- Efecto para controlar el ciclo de vida del bot ---
  useEffect(() => {
    console.log(`[useTradingBot] Efecto de ciclo de vida del bot activado. isBotRunning: ${isBotRunning}, selectedMarket: ${selectedMarket?.symbol}, useTestnet: ${useTestnet}`); // Añadido log de useTestnet
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket) { // Asegurarse de que hay un mercado seleccionado
      console.log(`[useTradingBot] Bot iniciado para ${selectedMarket.symbol} en ${useTestnet ? 'Testnet' : 'Mainnet'}. Intervalo: ${botIntervalMs / 1000}s`); // networkType ahora definida
      // Limpiar cualquier intervalo anterior
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        console.log("[useTradingBot] Intervalo previo del bot limpiado.");
      }
      executeBotStrategy(); // Ejecución inicial al iniciar
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId; // Guardar el nuevo ID del intervalo
    } else {
      // Si el bot no está corriendo o no hay mercado seleccionado, limpiar el intervalo
      if (botIntervalRef.current) {
        console.log("[useTradingBot] Bot detenido o sin mercado seleccionado. Limpiando intervalo.");
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
         console.log("[useTradingBot] Bot detenido o sin mercado seleccionado. No había intervalo activo.");
      }
    }

    // Función de limpieza al desmontar o cuando las dependencias cambian y el bot no debe correr
    return () => {
      console.log("[useTradingBot] Función de limpieza del efecto del bot activada.");
      if (intervalId) { // Limpiar el intervalo si fue creado en este ciclo del efecto
         clearInterval(intervalId);
         console.log("[useTradingBot] Intervalo del bot limpiado por función de limpieza.");
      }
       botIntervalRef.current = null; // Asegurarse de que la referencia esté limpia
       console.log("[useTradingBot] Función de limpieza del efecto del bot finalizada.");
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet]); // Añadir useTestnet a las dependencias


  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      console.log(`[useTradingBot] Cambiando estado del bot a: ${newStatus}`);
      // Defer toast to avoid state update warning when state is updated immediately
      setTimeout(() => {
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"}`,
          description: `El bot de trading ahora está ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'el mercado seleccionado'} en ${useTestnet ? 'Testnet' : 'Mainnet'}.`, // Usar networkType en el mensaje
          variant: newStatus ? "default" : "destructive",
        });
      }, 0); // Usar un timeout de 0 para ejecutar el toast después de que el estado se actualice
      return newStatus;
    });
  }, [toast, selectedMarket, useTestnet]); // Añadir dependencias para el mensaje del toast


  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    // Devolver los nuevos estados
    isPlacingOrder,
    placeOrderError,
  };
};
