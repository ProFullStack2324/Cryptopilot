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
  isBotRunning: boolean;
  setIsBotRunning: React.Dispatch<React.SetStateAction<boolean>>; // <--- AÑADE ESTA LÍNEA AQUÍ
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
  // --- AÑADIDO: Tipos de retorno para reglas y su error ---
  selectedMarketRules: any; // O un tipo más específico
  marketRulesError: string | null;
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
  isBotRunning, // <--- DESESTRUCTURAR isBotRunning AQUÍ
  setIsBotRunning, // <--- DESESTRUCTURAR setIsBotRunning AQUÍ
}: UseTradingBotProps): UseTradingBotReturn => {

  //const [isBotRunning, setIsBotRunning] = useState(false);
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // --- NUEVOS ESTADOS para la colocación de órdenes dentro del bot ---
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<any>(null);
  // --- FIN NUEVOS ESTADOS ---

  // --- INICIO MODIFICACIÓN: Nuevo estado para almacenar las reglas del mercado ---
  const [selectedMarketRules, setSelectedMarketRules] = useState<any>(null); // Usamos 'any' por simplicidad, idealmente definir una interfaz para las reglas
  // --- FIN MODIFICACIÓN: Nuevo estado para almacenar las reglas del mercado ---

  // --- NUEVO ESTADO PROPUESTO ---
  const [marketRulesError, setMarketRulesError] = useState<string | null>(null);
  // --- FIN NUEVO ESTADO PROPUESTO ---
  // Mínimo 5 segundos entre acciones reales del bot para evitar spam de órdenes
  const BOT_MIN_ACTION_INTERVAL_MS = 5000;


  // --- INICIO MODIFICACIÓN: Efecto para cargar las reglas del exchange ---
  useEffect(() => {
      const fetchMarketRules = async () => {
           if (!selectedMarket) {
               console.log("[useTradingBot] selectedMarket es nulo. Limpiando reglas del mercado.");
               setSelectedMarketRules(null); // Limpiar reglas si no hay mercado seleccionado
               return;
           }

           // Determinar la red para el log
           const networkType = useTestnet ? 'Testnet' : 'Mainnet';
           console.log(`[useTradingBot] Fetching exchange info for ${selectedMarket.symbol} on ${networkType}...`);

           // Construir el endpoint con el símbolo y el indicador de testnet
           const endpoint = `/api/binance/exchange-info?symbol=${selectedMarket.symbol}&isTestnet=${useTestnet}`;

           try {
               const response = await fetch(endpoint);
               const data = await response.json(); // La respuesta esperada es { success: boolean, data: {...}, message: string, ... }

               if (response.ok && data.success) { // Verificar tanto el estado HTTP como la propiedad 'success'
                   console.log(`[useTradingBot] Successfully fetched market rules for ${selectedMarket.symbol}.`);
                   // La respuesta del endpoint exchange-info para un símbolo específico debería contener
                   // los límites y la precisión directamente bajo 'data'.
                   // Si tu endpoint devuelve la estructura completa de 'markets' incluso para un símbolo,
                   // quizás necesites acceder a 'data[selectedMarket.symbol]'. Ajusta según la respuesta real.
                   // Asumiendo que 'data.data' ya contiene el objeto de reglas para el símbolo:
                   setSelectedMarketRules(data.data); // Almacenar las reglas obtenidas
                   console.log(`[useTradingBot] Reglas del mercado ${selectedMarket.symbol} almacenadas:`, data.data);

               } else {
                   console.error(`[useTradingBot] Error fetching market rules for ${selectedMarket.symbol}:`, data.message || `HTTP Error: ${response.status}`);
                   setSelectedMarketRules(null); // Limpiar o manejar error
                   // Opcional: Mostrar un toast de error al usuario si la carga de reglas falla
                   toast({
                     title: "Error al Cargar Reglas del Mercado",
                     description: `No se pudieron obtener las reglas para ${selectedMarket.symbol} en ${networkType}. Detalles: ${data.message || `HTTP Error: ${response.status}`}`,
                     variant: "destructive",
                   });
               }
           } catch (error: any) {
               console.error(`[useTradingBot] Fetch error for market rules for ${selectedMarket.symbol}:`, error);
                setSelectedMarketRules(null); // Limpiar o manejar error
                // Mostrar toast de error de conexión
                 toast({
                   title: "Error de Conexión",
                   description: `No se pudo conectar para obtener las reglas del mercado ${selectedMarket.symbol}. Detalles: ${error.message}`,
                   variant: "destructive",
                 });
           }
      };

      fetchMarketRules();

  }, [selectedMarket, useTestnet, toast]); // Este efecto SÓLO depende del mercado y la red de prueba y toast

  // --- FIN MODIFICACIÓN: Efecto para cargar las reglas del exchange ---











  
// --- Lógica principal de la estrategia del bot ---
// --- Lógica principal de la estrategia del bot ---
const executeBotStrategy = useCallback(async () => {
    // --- CORRECCIÓN 1: Definir networkType ---
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    // --- FIN CORRECCIÓN 1 ---

    // --- INICIO AÑADIDO: Grupo de logs para cada ejecución ---
    console.groupCollapsed(`[Bot Strategy] Ejecución ${new Date().toLocaleTimeString()} para ${selectedMarket?.symbol} en ${networkType}`); // Abre un grupo colapsado con timestamp
    // --- FIN AÑADIDO ---

    console.log(`[Bot Strategy] Intentando ejecutar estrategia. Estado bot: ${isBotRunning}, Mercado: ${selectedMarket?.symbol}, Precio: ${currentPrice}, Historial Length: ${currentMarketPriceHistory.length}, Reglas cargadas: ${!!selectedMarketRules}.`);


    if (!isBotRunning) { // Añadir verificación por si el estado cambia rápidamente
         console.log("[Bot Strategy] Bot no está corriendo. Saliendo de executeBotStrategy.");
         console.groupEnd(); // Cierra el grupo
         return;
    }
     // --- INICIO MODIFICACIÓN: Verificar también si las reglas del mercado están cargadas ---
     // Añadimos logs más específicos si falla alguna de estas condiciones iniciales
    if (!selectedMarket) {
        console.warn("[Bot Strategy] Datos insuficientes: selectedMarket es nulo.");
        console.groupEnd(); // Cierra el grupo
        return;
    }
    if (!currentPrice || currentPrice <= 0) {
         console.warn("[Bot Strategy] Datos insuficientes: currentPrice es inválido.");
         console.groupEnd(); // Cierra el grupo
         return;
    }
    if (currentMarketPriceHistory.length < 20) {
         console.warn(`[Bot Strategy] Datos insuficientes: historial de precios (${currentMarketPriceHistory.length}) menor a 20.`);
         console.groupEnd(); // Cierra el grupo
         return;
    }
    if (!selectedMarketRules) {
        console.warn("[Bot Strategy] Datos insuficientes: Reglas del mercado no cargadas.");
        // Opcional: Log del error específico si está disponible (si implementaste marketRulesError)
        // if(marketRulesError) console.warn(`[Bot Strategy] Detalle del error de reglas: ${marketRulesError}`);
        console.groupEnd(); // Cierra el grupo
        return;
    }
    // Si llegamos aquí, todas las condiciones iniciales se cumplen.
     console.log("[Bot Strategy] Condiciones iniciales cumplidas. Procediendo con la estrategia.");
    // --- FIN MODIFICACIÓN: Verificar también si las reglas del mercado están cargadas ---


    // Evitar acciones muy rápidas si el bot ya operó recientemente
    const timeSinceLastAction = Date.now() - botLastActionTimestamp;
    if (timeSinceLastAction < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy] Esperando intervalo mínimo entre acciones. Faltan ${BOT_MIN_ACTION_INTERVAL_MS - timeSinceLastAction}ms.`);
      console.groupEnd(); // Cierra el grupo
      return;
    }
    console.log(`[Bot Strategy] Intervalo mínimo entre acciones cumplido (${timeSinceLastAction}ms desde la última acción).`);


    console.log(`[Bot Strategy] Analizando ${selectedMarket.name} a precio: ${currentPrice} en ${networkType}`); // networkType ahora definida
    console.log(`[Bot Strategy] Historial de precios actual (${currentMarketPriceHistory.length} puntos):`, currentMarketPriceHistory.map(p => p.price));
     console.log(`[Bot Strategy] Reglas del mercado disponibles:`, selectedMarketRules); // Log para confirmar que las reglas están disponibles


    // Asegurarse de que hay suficientes puntos para acceder a latest y previous
    if (currentMarketPriceHistory.length < 2) {
        console.warn("[Bot Strategy] Historial de precios insuficiente para calcular indicadores.");
         console.groupEnd(); // Cierra el grupo
        return;
    }

    const latestPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
    const previousPriceDataPoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 2]; // Para cruces de SMA/MACD

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let triggerReason = "Ninguna";

    // --- Estrategia de Cruce de SMA (ejemplo) ---
    console.log(`[Bot Strategy - SMA] Evaluando estrategia SMA...`);
     if (latestPriceDataPoint.sma10 !== undefined && latestPriceDataPoint.sma20 !== undefined &&
        previousPriceDataPoint.sma10 !== undefined && previousPriceDataPoint.sma20 !== undefined) {

         console.log(`[Bot Strategy - SMA] Última SMA10: ${latestPriceDataPoint.sma10}, Última SMA20: ${latestPriceDataPoint.sma20}. Previa SMA10: ${previousPriceDataPoint.sma10}, Previa SMA20: ${previousPriceDataPoint.sma20}.`);


        // Cruce alcista: SMA10 cruza por encima de SMA20
        if (latestPriceDataPoint.sma10 > latestPriceDataPoint.sma20 &&
            previousPriceDataPoint.sma10 <= previousPriceDataPoint.sma20) {
            action = 'buy';
            triggerReason = "Cruce SMA Alcista";
            console.log("[Bot Strategy - SMA] Señal de COMPRA detectada por Cruce SMA Alcista.");
        }
        // Cruce bajista: SMA10 cruza por debajo de SMA20
        else if (latestPriceDataPoint.sma10 < latestPriceDataPoint.sma20 &&
                 previousPriceDataPoint.sma10 >= previousPriceDataPoint.sma20) {
            action = 'sell';
            triggerReason = "Cruce SMA Bajista";
             console.log("[Bot Strategy - SMA] Señal de VENTA detectada por Cruce SMA Bajista.");
        } else {
             console.log("[Bot Strategy - SMA] No se detectó cruce significativo de SMA.");
        }
    } else {
        console.log(`[Bot Strategy - SMA] Datos de SMA insuficientes. Saltando estrategia SMA.`);
    }


    // --- Estrategia de MACD (ejemplo) ---
    // Solo evaluar MACD si la SMA no dio una señal
     if (action === 'hold') {
         console.log(`[Bot Strategy - MACD] Evaluando estrategia MACD (SMA no dio señal)...`);
         if (latestPriceDataPoint.macdHistogram !== undefined && previousPriceDataPoint.macdHistogram !== undefined) {
            console.log(`[Bot Strategy - MACD] Último Histograma: ${latestPriceDataPoint.macdHistogram}, Previo Histograma: ${previousPriceDataPoint.macdHistogram}.`);
          // Cambio de histograma de negativo a positivo (señal de compra)
          if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
            action = 'buy';
            triggerReason = "MACD Histograma Positivo";
             console.log("[Bot Strategy - MACD] Señal de COMPRA detectada por MACD Histograma.");
          }
          // Cambio de histograma de positivo a negativo (señal de venta)
          else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
            action = 'sell';
            triggerReason = "MACD Histograma Negativo";
             console.log("[Bot Strategy - MACD] Señal de VENTA detectada por MACD Histograma.");
          } else {
             console.log("[Bot Strategy - MACD] No se detectó cruce de Histograma de MACD.");
          }
        } else {
             console.log(`[Bot Strategy - MACD] Datos de MACD Histograma insuficientes. Saltando estrategia MACD.`);
        }
    } else {
        console.log(`[Bot Strategy - MACD] MACD no evaluado porque SMA ya dio una señal (${action}).`);
    }


    console.log(`[Bot Decision] ${selectedMarket.symbol} (${networkType}): Acción decidida: ${action.toUpperCase()} por: ${triggerReason}`);

    // --- Ejecutar la orden si se decide una acción ---
    if (action !== 'hold') {
      console.log(`[Bot Action] Preparando para ejecutar acción: ${action.toUpperCase()}.`);
      let tradeAmount = 0;
      // Determinar la cantidad a operar. Puedes usar un porcentaje de tu balance.
      // Aquí usamos el balance de quoteAsset (ej. USDT) para compras y baseAsset (ej. BTC) para ventas.

      // Verificar balances ANTES de intentar calcular la cantidad
      if (!allBinanceBalances) {
          console.error(`[Bot Action] Balances no cargados. No se puede determinar la cantidad a operar.`);
           console.groupEnd(); // Cierra el grupo
          return; // Abortar si los balances no están disponibles
      }

      // --- Lógica para COMPRA ---
      if (action === 'buy') {
           console.log("[Bot Action - Buy] Lógica de compra iniciada.");
           // Asegurarse de tener balance del activo de cotización (ej. USDT)
           const quoteBalanceInfo = allBinanceBalances[selectedMarket.quoteAsset];
           if (!quoteBalanceInfo) {
               console.error(`[Bot Action - Buy] No se encontró información de balance para el activo de cotización (${selectedMarket.quoteAsset}). Abortando compra.`);
                console.groupEnd(); // Cierra el grupo
               return;
           }
           const availableQuote = quoteBalanceInfo.available; // available ya es un number

           if (availableQuote <= 0) {
               console.warn(`[Bot Action - Buy] Balance disponible de ${selectedMarket.quoteAsset} es cero o negativo (${availableQuote}). Abortando compra.`);
                console.groupEnd(); // Cierra el grupo
               return;
           }


           const investmentPercentage = 0.05; // Ejemplo: Invertir 5% del balance disponible
           let desiredQuoteAmount = availableQuote * investmentPercentage; // Usar let porque podríamos ajustarlo
            console.log(`[Bot Action - Buy] Balance disponible de ${selectedMarket.quoteAsset}: ${availableQuote}. Deseo invertir ${investmentPercentage*100}%, equivalente a ${desiredQuoteAmount} ${selectedMarket.quoteAsset}.`);


           // --- Aplicar reglas del exchange para BUY ---
           const marketRules = selectedMarketRules; // Renombrar para claridad

           // Ya verificamos selectedMarketRules al inicio de executeBotStrategy, pero una doble verificación no hace daño
           if (!marketRules || !marketRules.limits || !marketRules.precision) {
                console.error(`[Bot Action - Buy] Reglas del exchange incompletas (segunda verificación). No se puede validar la orden de compra.`);
                 console.groupEnd(); // Cierra el grupo
                return; // Abortar si las reglas no están disponibles o están incompletas
           }

           const minNotional = parseFloat(marketRules.limits.cost.min);
           const minQty = parseFloat(marketRules.limits.amount.min);
           const stepSize = parseFloat(marketRules.precision.amount);

            console.log(`[Bot Action - Buy] Reglas del mercado aplicadas: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);


           // 1. Calcular cantidad base inicial
           // Asegurarse de que currentPrice sea válido para evitar división por cero o NaN
           if (!currentPrice || currentPrice <= 0) {
                console.error(`[Bot Action - Buy] Precio actual inválido (${currentPrice}) al calcular cantidad. Abortando compra.`);
                 console.groupEnd(); // Cierra el grupo
                return;
           }
           tradeAmount = desiredQuoteAmount / currentPrice;
            console.log(`[Bot Action - Buy] Cantidad base inicial calculada: ${tradeAmount} ${selectedMarket.baseAsset} (basado en ${desiredQuoteAmount} ${selectedMarket.quoteAsset} y precio ${currentPrice}).`);


           // 2. Validar minNotional (cantidad en término de quoteAsset)
           const currentNotional = tradeAmount * currentPrice;
           if (currentNotional < minNotional) {
               console.warn(`[Bot Action - Buy] Cantidad nominal (${currentNotional.toFixed(selectedMarket.quotePrecision || 2)}) por debajo del mínimo (${minNotional}) para ${selectedMarket.symbol}. Ajustando tradeAmount para cumplir minNotional...`);
               tradeAmount = minNotional / currentPrice; // Ajustar la cantidad base para que el nominal sea exactamente minNotional
                console.log(`[Bot Action - Buy] tradeAmount ajustado para minNotional: ${tradeAmount}`);
           }


            // 3. Aplicar stepSize (para la cantidad base)
           if (stepSize > 0) { // Asegurarse de que stepSize sea válido y no cero
               // Ajustar la cantidad al múltiplo más cercano (hacia abajo para no sobrepasar balance o minQty)
               tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
                // Asegurarse de que el ajuste no resulte en un número negativo o en NaN debido a floating point issues
                // Usamos la precisión adecuada del mercado para el redondeo final
                tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || selectedMarket.quotePrecision || 6)); // Redondeo a la precisión del mercado
                console.log(`[Bot Action - Buy] tradeAmount ajustado al stepSize (${stepSize}): ${tradeAmount} para ${selectedMarket.symbol}.`);
           } else {
                console.warn(`[Bot Action - Buy] stepSize es cero o inválido (${stepSize}). No se aplicará ajuste de stepSize.`);
           }


            // 4. Validar minQty (cantidad base mínima) después de ajustes
            if (tradeAmount < minQty) {
                console.warn(`[Bot Action - Buy] Cantidad base (${tradeAmount}) después de ajustes por debajo del mínimo (${minQty}) para ${selectedMarket.symbol}. Abortando orden de compra.`);
                 console.groupEnd(); // Cierra el grupo
                return; // Abortar si la cantidad final es menor que la mínima
            }

           // 5. Validar si la cantidad ajustada es mayor que cero
           if (tradeAmount <= 0) {
                console.warn(`[Bot Action - Buy] Cantidad base final ajustada fue <= 0 para ${selectedMarket.symbol}. Abortando orden de compra.`);
                 console.groupEnd(); // Cierra el grupo
                return;
           }

            console.log(`[Bot Action - Buy] Cantidad final de compra validada/ajustada: ${tradeAmount} ${selectedMarket.baseAsset}.`);

      } // --- FIN Lógica para COMPRA ---


      // --- Lógica para VENTA ---
      else if (action === 'sell') { // action === 'sell' && botOpenPosition && allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.baseAsset] ya se verifica parcialmente por la lógica exterior
          console.log("[Bot Action - Sell] Lógica de venta iniciada.");

          // Asegurarse de tener una posición abierta del bot
          if (!botOpenPosition) {
               console.warn(`[Bot Action - Sell] No hay posición abierta del bot para vender. Abortando venta.`);
                console.groupEnd(); // Cierra el grupo
               return;
          }
          // Asegurarse de tener balance del activo base (ej. BTC)
          const baseBalanceInfo = allBinanceBalances ? allBinanceBalances[selectedMarket.baseAsset] : null;
           if (!baseBalanceInfo) {
               console.error(`[Bot Action - Sell] No se encontró información de balance para el activo base (${selectedMarket.baseAsset}). Abortando venta.`);
                console.groupEnd(); // Cierra el grupo
               return;
           }
          const availableBase = baseBalanceInfo.available;

          // Verificar si el balance disponible es suficiente para cubrir la posición abierta simulada
          if (availableBase < botOpenPosition.amount) {
               console.warn(`[Bot Action - Sell] Balance insuficiente de ${selectedMarket.baseAsset} (${availableBase}) para cerrar la posición abierta simulada (${botOpenPosition.amount}). Abortando venta y cerrando posición simulada.`);
               setBotOpenPosition(null); // Cerrar la posición simulada ya que no hay balance real
                console.groupEnd(); // Cierra el grupo
               return;
          }

           console.log(`[Bot Action - Sell] Posición abierta simulada: ${botOpenPosition.amount}. Balance disponible ${selectedMarket.baseAsset}: ${availableBase}.`);


          // --- Aplicar reglas del exchange para SELL ---
          const marketRules = selectedMarketRules; // Renombrar para claridad

           if (!marketRules || !marketRules.limits || !marketRules.precision) {
                console.error(`[Bot Action - Sell] Reglas del exchange incompletas (segunda verificación). No se puede validar la orden de venta.`);
                setBotOpenPosition(null); // Opcional: Considerar cerrar la posición simulada
                 console.groupEnd(); // Cierra el grupo
                return; // Abortar si las reglas no están disponibles o están incompletas
           }
           const minQty = parseFloat(marketRules.limits.amount.min);
           const stepSize = parseFloat(marketRules.precision.amount);
            const minNotional = parseFloat(marketRules.limits.cost.min); // También necesitamos minNotional para ventas

           console.log(`[Bot Action - Sell] Reglas del mercado aplicadas: minNotional=${minNotional}, minQty=${minQty}, stepSize=${stepSize}`);

           // Cantidad inicial de venta es la posición abierta simulada (ya verificamos balance suficiente)
           tradeAmount = botOpenPosition.amount;
           console.log(`[Bot Action - Sell] Cantidad base inicial de venta: ${tradeAmount} ${selectedMarket.baseAsset}.`);


           // 1. Aplicar stepSize a la cantidad de venta
           if (stepSize > 0) { // Asegurarse de que stepSize sea válido y no cero
               tradeAmount = Math.floor(tradeAmount / stepSize) * stepSize;
                tradeAmount = parseFloat(tradeAmount.toFixed(selectedMarket.amountPrecision || selectedMarket.quotePrecision || 6)); // Redondeo a la precisión del mercado
                console.log(`[Bot Action - Sell] tradeAmount ajustado al stepSize (${stepSize}): ${tradeAmount} para ${selectedMarket.symbol}.`);
           } else {
                 console.warn(`[Bot Action - Sell] stepSize es cero o inválido (${stepSize}). No se aplicará ajuste de stepSize.`);
           }


           // 2. Validar minQty después de ajustes
            if (tradeAmount < minQty) {
                console.warn(`[Bot Action - Sell] Cantidad base (${tradeAmount}) después de ajustes por debajo del mínimo (${minQty}) para ${selectedMarket.symbol}. Abortando orden de venta.`);
                setBotOpenPosition(null); // Opcional: Considerar cerrar la posición simulada si no se puede vender realmente
                 console.groupEnd(); // Cierra el grupo
                return; // Abortar si la cantidad final es menor que la mínima
            }

           // 3. Validar minNotional para la venta (cantidad base * precio actual)
            // Asegurarse de que currentPrice sea válido para el cálculo nominal
            if (!currentPrice || currentPrice <= 0) {
                 console.error(`[Bot Action - Sell] Precio actual inválido (${currentPrice}) al calcular nominal de venta. Abortando venta.`);
                 setBotOpenPosition(null); // Opcional: Considerar cerrar la posición simulada
                  console.groupEnd(); // Cierra el grupo
                 return;
            }
            const currentNotional = tradeAmount * currentPrice;
            if (currentNotional < minNotional) {
                console.warn(`[Bot Action - Sell] Cantidad nominal de venta (${currentNotional.toFixed(selectedMarket.quotePrecision || 2)}) por debajo del mínimo (${minNotional}) para ${selectedMarket.symbol}. Abortando orden de venta.`);
                 setBotOpenPosition(null); // Opcional: Considerar cerrar la posición simulada si no se puede vender realmente
                  console.groupEnd(); // Cierra el grupo
                return; // Abortar si la cantidad nominal es menor que la mínima
            }

            // 4. Validar si la cantidad ajustada es mayor que cero
           if (tradeAmount <= 0) {
                console.warn(`[Bot Action - Sell] Cantidad base final ajustada para venta fue <= 0 para ${selectedMarket.symbol}. Abortando y cerrando posición simulada.`);
                 setBotOpenPosition(null); // Considerar cerrar la posición simulada
                  console.groupEnd(); // Cierra el grupo
                return;
           }

            console.log(`[Bot Action - Sell] Cantidad final de venta validada/ajustada: ${tradeAmount} ${selectedMarket.baseAsset}.`);
      } // --- FIN Lógica para VENTA ---


      // --- Si llegamos aquí, la cantidad tradeAmount es válida y > 0 para la acción decidida ---
       console.log(`[Bot Action] Cantidad validada para ${action.toUpperCase()}: ${tradeAmount} ${selectedMarket.baseAsset}. Procediendo a colocar orden.`);

      // --- INICIO SECCIÓN MODIFICADA: Colocación de Orden a través de Endpoint de API ---
      setIsPlacingOrder(true); // Indicar que estamos colocando una orden
      setPlaceOrderError(null); // Limpiar error anterior

      const orderData = {
        symbol: selectedMarket.symbol, // Usar el símbolo directo (ej. BTCUSDT) que esperan los endpoints
        type: 'market', // Por ahora, solo órdenes de mercado para simplificar
        side: action,
        amount: tradeAmount,
        // price no es estrictamente necesario para órdenes de mercado, pero se puede incluir como referencia
        price: currentPrice, // Precio de referencia (para logs o posible uso futuro)
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
               // Loguear los detalles del error del backend si están disponibles
               console.error(`[useTradingBot] Detalles del error del backend:`, tradeResult?.details || tradeResult?.message || 'No details provided');

               setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
               // Notificar al UI si hay un callback
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });

               // Mostrar toast de error
             toast({
               title: "Bot: Error al Colocar Orden",
               description: `Hubo un problema al intentar colocar la orden en ${selectedMarket?.symbol} en ${networkType}. Detalles: ${tradeResult?.message || tradeResult?.details || `Error HTTP: ${response.status}`}`, // Incluir más detalles del error si están disponibles
               variant: "destructive",
             });
              console.groupEnd(); // Cierra el grupo en caso de error de la orden


           } else {
               console.log(`[useTradingBot] Orden del bot colocada con éxito en ${networkType}. Order ID: ${tradeResult.orderId}`);
               setBotLastActionTimestamp(Date.now()); // Actualizar timestamp solo si la orden fue exitosa

               // Notificar al UI si hay un callback
               if(onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

               // --- Actualización de Posición Simulada del Bot basada en el RESULTADO REAL ---
               if (action === 'buy') {
                   // Si la compra fue exitosa, establecer la nueva posición abierta
                    console.log("[useTradingBot] Actualizando posición simulada: Compra exitosa.");
                    // Asegurarse de que los datos de tradeResult tengan las propiedades esperadas
                    if (tradeResult.executedQty && tradeResult.price && tradeResult.transactTime) {
                        setBotOpenPosition({
                            marketId: selectedMarket.id,
                            entryPrice: parseFloat(tradeResult.price), // Precio de ejecución real
                            amount: parseFloat(tradeResult.executedQty), // Cantidad ejecutada real
                            type: 'buy',
                            timestamp: Math.floor(tradeResult.transactTime / 1000) // Timestamp de la transacción real
                            
                        });
                        console.log(`[useTradingBot] Posición simulada actualizada con datos reales: EntryPrice=${tradeResult.price}, Amount=${tradeResult.executedQty}`);
                    } else {
                         console.warn("[useTradingBot] Datos de tradeResult incompletos para actualizar posición simulada con datos reales. Usando fallback data.");
                        setBotOpenPosition({
                           marketId: selectedMarket.id,
                           entryPrice: currentPrice!, // Fallback al precio actual (asumimos válido por verificación inicial)
                           amount: tradeAmount, // Fallback a la cantidad solicitada
                           type: 'buy',
                           timestamp: Math.floor(Date.now() / 1000)
                        });
                         console.log(`[useTradingBot] Posición simulada actualizada con datos fallback: EntryPrice=${currentPrice}, Amount=${tradeAmount}`);
                    }

                    // Mostrar toast de éxito de compra
                    toast({
                      title: "Bot: Compra Ejecutada",
                      description: `Orden de ${tradeResult.executedQty || tradeAmount} ${selectedMarket.baseAsset} colocada en ${selectedMarket.symbol} en ${networkType}.`, // Usar cantidad ejecutada o solicitada
                      variant: "default",
                    });
                     console.groupEnd(); // Cierra el grupo en caso de éxito

               } else if (action === 'sell') {
                   // Si la venta fue exitosa, cerrar la posición abierta simulada
                   console.log("[useTradingBot] Actualizando posición simulada: Venta exitosa.");
                   // Calcular PnL simulado si había una posición de compra abierta para este mercado
                    if(botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
                        const exitPrice = tradeResult.price ? parseFloat(tradeResult.price) : currentPrice!; // Usar precio de ejecución o actual
                        const executedAmount = tradeResult.executedQty ? parseFloat(tradeResult.executedQty) : tradeAmount; // Usar cantidad ejecutada o solicitada

                        // Asegurarse de que los números son válidos para el cálculo
                        if(botOpenPosition.entryPrice !== undefined && botOpenPosition.amount !== undefined && exitPrice !== undefined && executedAmount !== undefined) {
                             const pnl = (exitPrice - botOpenPosition.entryPrice) * executedAmount;
                             console.log(`[useTradingBot] PnL simulado de la operación: ${pnl.toFixed(selectedMarket.quotePrecision || 2)} ${selectedMarket.quoteAsset}`); // Usar quotePrecision
                             // Aquí podrías guardar este PnL en un estado o historial si lo necesitas
                        } else {
                            console.warn("[useTradingBot] Datos insuficientes para calcular PnL simulado.");
                        }
                    }
                   setBotOpenPosition(null); // Cerrar la posición simulada

                    // Mostrar toast de éxito de venta
                    toast({
                      title: "Bot: Venta Ejecutada",
                      description: `Orden de ${tradeResult.executedQty || tradeAmount} ${selectedMarket.baseAsset} colocada en ${selectedMarket.symbol} en ${networkType}.`, // Usar cantidad ejecutada o solicitada
                       variant: "default", // O una variante de éxito específica
                    });
                     console.groupEnd(); // Cierra el grupo en caso de éxito
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
            console.groupEnd(); // Cierra el grupo en caso de error de conexión


      } finally {
          setIsPlacingOrder(false); // Finalizar estado de carga de colocación de orden
      }
      // --- FIN SECCIÓN MODIFICADA: Colocación de Orden a través de Endpoint de API ---
    } else {
       console.log(`[Bot Action] No se decidió acción (${action}). Saltando colocación de orden.`);
        console.groupEnd(); // Cierra el grupo si no hay acción
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
    selectedMarketRules, // --- INICIO MODIFICACIÓN: Añadir dependencia para las reglas ---
  ]); // --- FIN MODIFICACIÓN: Añadir dependencia para las reglas ---

  // --- Efecto para controlar el ciclo de vida del bot ---
  // --- Efecto para controlar el ciclo de vida del bot ---
  useEffect(() => {
    // --- INICIO MODIFICACIÓN: Añadir verificación si las reglas del mercado están cargadas antes de iniciar el intervalo ---
     // El bot solo debe iniciar si hay un mercado seleccionado Y sus reglas se han cargado.
    console.log(`[useTradingBot] Efecto de ciclo de vida del bot activado. isBotRunning: ${isBotRunning}, selectedMarket: ${selectedMarket?.symbol}, useTestnet: ${useTestnet}, selectedMarketRules loaded: ${!!selectedMarketRules}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket && selectedMarketRules) { // Asegurarse de que hay un mercado seleccionado Y las reglas están cargadas
    // --- FIN MODIFICACIÓN: Añadir verificación si las reglas del mercado están cargadas antes de iniciar el intervalo ---

      console.log(`[useTradingBot] Bot iniciado para ${selectedMarket.symbol} en ${useTestnet ? 'Testnet' : 'Mainnet'}. Intervalo: ${botIntervalMs / 1000}s`);
      // Limpiar cualquier intervalo anterior
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        console.log("[useTradingBot] Intervalo previo del bot limpiado.");
      }
      executeBotStrategy(); // Ejecución inicial al iniciar
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId; // Guardar el nuevo ID del intervalo
    } else {
      // Si el bot no está corriendo, no hay mercado seleccionado, O las reglas no están cargadas, limpiar el intervalo
      if (botIntervalRef.current) {
         // --- INICIO MODIFICACIÓN: Log más específico cuando no se cumplen las condiciones ---
        console.log(`[useTradingBot] Bot detenido, sin mercado seleccionado, o reglas no cargadas. Limpiando intervalo.`);
        if (!selectedMarket) console.log("[useTradingBot] Razón: No hay mercado seleccionado.");
        if (!selectedMarketRules) {
             console.log("[useTradingBot] Razón: Reglas del mercado no cargadas.");
             // --- AÑADIDO: Log del error específico si existe ---
             // Asegúrate de que marketRulesError esté disponible en este scope si no está en las dependencias
             // Si ya lo declaraste con useState al inicio del hook, estará disponible.
             if(marketRulesError) console.log(`[useTradingBot] Detalle del error de reglas: ${marketRulesError}`);
        }
         // --- FIN MODIFICACIÓN: Log más específico cuando no se cumplen las condiciones ---
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      } else {
         console.log("[useTradingBot] Bot detenido, sin mercado seleccionado, o reglas no cargadas. No había intervalo activo.");
         // --- AÑADIDO: Log del error específico si el bot nunca inició por reglas ---
         // Similar al log anterior, asegúrate de que marketRulesError esté disponible.
         if(!selectedMarket && marketRulesError) console.log(`[useTradingBot] Detalle del error de reglas (bot inactivo): ${marketRulesError}`);
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
     // --- INICIO MODIFICACIÓN: Añadir selectedMarketRules (y opcionalmente marketRulesError) a las dependencias ---
     // Añadir marketRulesError como dependencia hará que este efecto se re-ejecute si cambia el estado del error,
     // lo cual puede ser útil para detener el bot si el error aparece mientras corre.
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet, selectedMarketRules, marketRulesError /* Opcional: Añadir marketRulesError aquí */]);
   // --- FIN MODIFICACIÓN: Añadir selectedMarketRules (y opcionalmente marketRulesError) a las dependencias ---

  // ... (Resto del código del hook useTradingBot) ...

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
  }, [toast, selectedMarket, useTestnet]);


  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    // Devolver los nuevos estados
    isPlacingOrder,
    placeOrderError,
    // --- AÑADIDO: Devolver selectedMarketRules y marketRulesError ---
    selectedMarketRules,
    marketRulesError,
  };
};

