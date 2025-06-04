
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
  useTestnet?: boolean; // Prop para indicar si el bot debe operar en Testnet
  onBotAction?: (result: { type: 'orderPlaced', success: boolean, details?: any }) => void;
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
  useTestnet = false, // Valor por defecto: Mainnet
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

  // Log inicial para ver las props recibidas por el hook
  useEffect(() => {
    console.log('[useTradingBot] Hook inicializado/actualizado. Props:', { selectedMarket: selectedMarket?.symbol, currentPrice, useTestnet, botIntervalMs });
  }, [selectedMarket, currentPrice, useTestnet, botIntervalMs]);

  const executeBotStrategy = useCallback(async () => {
    // ==========================================================================================
    // INICIO: Lógica de Estrategia del Bot y Colocación de Órdenes
    // ==========================================================================================
    const currentTimestamp = Date.now();
    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[Bot Strategy - ${networkType}] Ejecutando a las ${new Date(currentTimestamp).toLocaleTimeString()}.`);

    if (!isBotRunning) {
      console.log(`[Bot Strategy - ${networkType}] Bot no está corriendo. Saliendo.`);
      return;
    }
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20) {
      console.warn(`[Bot Strategy - ${networkType}] Datos insuficientes para ${selectedMarket?.symbol || 'N/A'}. Precio: ${currentPrice}, Historial: ${currentMarketPriceHistory.length} puntos. Saltando estrategia.`);
      return;
    }
    if (currentTimestamp - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log(`[Bot Strategy - ${networkType}] Esperando ${((BOT_MIN_ACTION_INTERVAL_MS - (currentTimestamp - botLastActionTimestamp))/1000).toFixed(1)}s más para intervalo mínimo entre acciones.`);
      return;
    }

    console.log(`[Bot Strategy - ${networkType}] Analizando ${selectedMarket.name} (Símbolo: ${selectedMarket.symbol}). Precio actual: ${currentPrice}.`);
    // console.log(`[Bot Strategy - ${networkType}] Historial de precios (últimos 5):`, currentMarketPriceHistory.slice(-5).map(p => ({price: p.price, sma10: p.sma10, sma20: p.sma20})) );

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
      console.log(`[Bot Strategy - SMA - ${networkType}] SMA10: ${latestPriceDataPoint.sma10.toFixed(2)} (prev: ${previousPriceDataPoint.sma10.toFixed(2)}), SMA20: ${latestPriceDataPoint.sma20.toFixed(2)} (prev: ${previousPriceDataPoint.sma20.toFixed(2)}).`);
    } else {
      console.log(`[Bot Strategy - SMA - ${networkType}] Datos de SMA no disponibles o insuficientes.`);
    }

    // --- Estrategia de MACD (ejemplo) ---
    if (action === 'hold' && latestPriceDataPoint?.macdHistogram !== undefined && previousPriceDataPoint?.macdHistogram !== undefined) {
      if (latestPriceDataPoint.macdHistogram > 0 && previousPriceDataPoint.macdHistogram <= 0) {
        action = 'buy';
        triggerReason = "Cruce MACD Histograma a Positivo";
      } else if (latestPriceDataPoint.macdHistogram < 0 && previousPriceDataPoint.macdHistogram >= 0) {
        action = 'sell';
        triggerReason = "Cruce MACD Histograma a Negativo";
      }
      console.log(`[Bot Strategy - MACD - ${networkType}] Histograma MACD: ${latestPriceDataPoint.macdHistogram.toFixed(4)} (prev: ${previousPriceDataPoint.macdHistogram.toFixed(4)}).`);
    } else {
      if (action !== 'hold') console.log(`[Bot Strategy - MACD - ${networkType}] Estrategia SMA ya decidió una acción. Saltando MACD.`);
      else console.log(`[Bot Strategy - MACD - ${networkType}] Datos de MACD no disponibles o insuficientes.`);
    }

    console.log(`[Bot Decision - ${networkType}] Mercado: ${selectedMarket.symbol}. Acción decidida: ${action.toUpperCase()}. Razón: ${triggerReason}`);

    // --- Lógica de Colocación de Orden ---
    if (action !== 'hold') {
      let tradeAmount = 0;
      const baseAsset = selectedMarket.baseAsset;
      const quoteAsset = selectedMarket.quoteAsset;
      const amountPrecision = selectedMarket.amountPrecision || 6; // Precisión para la cantidad del activo base
      const quotePrecision = selectedMarket.quotePrecision || 2; // Precisión para la cantidad del activo cotizado (USDT)

      if (action === 'buy') {
        if (allBinanceBalances && allBinanceBalances[quoteAsset]) {
          const availableQuote = allBinanceBalances[quoteAsset].available;
          const investmentPercentage = 0.05; // Invertir 5% del balance de quoteAsset
          let desiredQuoteAmount = availableQuote * investmentPercentage;
          console.log(`[Bot Action - Buy - ${networkType}] Balance ${quoteAsset}: ${availableQuote.toFixed(quotePrecision)}. Intento de inversión: ${desiredQuoteAmount.toFixed(quotePrecision)} ${quoteAsset}.`);

          // Validación contra minNotional
          if (selectedMarket.minNotional && desiredQuoteAmount < selectedMarket.minNotional) {
            console.warn(`[Bot Action - Buy - ${networkType}] Monto deseado ${desiredQuoteAmount.toFixed(quotePrecision)} ${quoteAsset} es MENOR que minNotional ${selectedMarket.minNotional}. NO SE OPERA.`);
            toast({ title: `Bot: Monto Bajo (Compra ${networkType})`, description: `Intento de compra por ${desiredQuoteAmount.toFixed(quotePrecision)} ${quoteAsset} no cumple el mínimo de ${selectedMarket.minNotional}.`, variant: "destructive", duration: 7000 });
            return;
          }
          
          tradeAmount = parseFloat((desiredQuoteAmount / currentPrice).toFixed(amountPrecision));

          // Validación contra minQty
          if (selectedMarket.minQty && tradeAmount < selectedMarket.minQty) {
            console.warn(`[Bot Action - Buy - ${networkType}] Cantidad calculada ${tradeAmount.toFixed(amountPrecision)} ${baseAsset} es MENOR que minQty ${selectedMarket.minQty}. NO SE OPERA.`);
            toast({ title: `Bot: Cantidad Baja (Compra ${networkType})`, description: `Intento de compra por ${tradeAmount.toFixed(amountPrecision)} ${baseAsset} no cumple la cantidad mínima de ${selectedMarket.minQty}.`, variant: "destructive", duration: 7000 });
            return;
          }
          console.log(`[Bot Action - Buy - ${networkType}] Cantidad ${baseAsset} calculada: ${tradeAmount}. Valor estimado: ${(tradeAmount * currentPrice).toFixed(quotePrecision)} ${quoteAsset}.`);
        } else {
          console.warn(`[Bot Action - Buy - ${networkType}] No hay balance de ${quoteAsset} o información de balances no disponible.`);
          return;
        }
      } else if (action === 'sell') { // Vender
        if (botOpenPosition && botOpenPosition.marketId === selectedMarket.id && botOpenPosition.type === 'buy') {
          // Si hay una posición de compra abierta por el bot para este mercado, intentar cerrarla.
          const availableBase = allBinanceBalances?.[baseAsset]?.available ?? 0;
          tradeAmount = botOpenPosition.amount; // Vender la cantidad de la posición abierta
          console.log(`[Bot Action - Sell - ${networkType}] Intentando cerrar posición abierta de ${tradeAmount.toFixed(amountPrecision)} ${baseAsset}. Balance disponible: ${availableBase.toFixed(amountPrecision)} ${baseAsset}.`);

          if (availableBase < tradeAmount) {
             console.warn(`[Bot Action - Sell - ${networkType}] Balance disponible ${availableBase.toFixed(amountPrecision)} ${baseAsset} es INSUFICIENTE para vender la posición de ${tradeAmount.toFixed(amountPrecision)}. Saltando.`);
             // Podríamos optar por vender lo disponible, o no hacer nada. Por ahora, no hacemos nada.
             return;
          }
        } else if (allBinanceBalances && allBinanceBalances[baseAsset]) {
            // Lógica alternativa si no hay posición abierta del bot, pero queremos vender basado en señal (ej. vender un % del baseAsset)
            // const availableBase = allBinanceBalances[baseAsset].available;
            // const sellPercentage = 0.10; // Vender 10% del baseAsset disponible
            // tradeAmount = parseFloat((availableBase * sellPercentage).toFixed(amountPrecision));
            console.log(`[Bot Action - Sell - ${networkType}] No hay posición de compra abierta por el bot para ${selectedMarket.symbol} o señal de venta sin posición previa. No se ejecutará venta por defecto. Implementar lógica si es necesario.`);
            return; // Por ahora, solo vendemos para cerrar posiciones abiertas por el bot
        } else {
          console.warn(`[Bot Action - Sell - ${networkType}] No hay posición abierta para cerrar o no hay balance de ${baseAsset}.`);
          return;
        }

        // Validación contra minQty para la venta
        if (selectedMarket.minQty && tradeAmount < selectedMarket.minQty) {
            console.warn(`[Bot Action - Sell - ${networkType}] Cantidad a vender ${tradeAmount.toFixed(amountPrecision)} ${baseAsset} es MENOR que minQty ${selectedMarket.minQty}. NO SE OPERA.`);
            toast({ title: `Bot: Cantidad Baja (Venta ${networkType})`, description: `Intento de venta por ${tradeAmount.toFixed(amountPrecision)} ${baseAsset} no cumple la cantidad mínima de ${selectedMarket.minQty}.`, variant: "destructive", duration: 7000 });
            return;
        }
        // Validación contra minNotional para la venta
        const estimatedSellValue = tradeAmount * currentPrice;
        if (selectedMarket.minNotional && estimatedSellValue < selectedMarket.minNotional) {
            console.warn(`[Bot Action - Sell - ${networkType}] Valor estimado de venta ${estimatedSellValue.toFixed(quotePrecision)} ${quoteAsset} es MENOR que minNotional ${selectedMarket.minNotional}. NO SE OPERA.`);
            toast({ title: `Bot: Monto Bajo (Venta ${networkType})`, description: `Intento de venta por valor de ${estimatedSellValue.toFixed(quotePrecision)} ${quoteAsset} no cumple el mínimo de ${selectedMarket.minNotional}.`, variant: "destructive", duration: 7000 });
            return;
        }
        console.log(`[Bot Action - Sell - ${networkType}] Cantidad ${baseAsset} a vender: ${tradeAmount}. Valor estimado: ${estimatedSellValue.toFixed(quotePrecision)} ${quoteAsset}.`);
      }

      if (tradeAmount <= 0) {
        console.warn(`[Bot Action - ${networkType}] Cantidad de trade calculada es <= 0 para ${action} ${selectedMarket.symbol}. Saltando orden.`);
        return;
      }

      setIsPlacingOrder(true);
      setPlaceOrderError(null);

      const orderData: OrderFormData = {
        marketId: selectedMarket.symbol, // Los endpoints esperan el symbol, ej. BTCUSDT
        orderType: 'market',
        type: action, // 'buy' o 'sell'
        amount: tradeAmount,
        price: currentPrice, // Precio de referencia para órdenes de mercado
      };

      // ==========================================================================================
      // PUNTO CLAVE: Selección del Endpoint (Mainnet o Testnet)
      // ==========================================================================================
      // La variable `useTestnet` (prop del hook) determina qué endpoint se usará.
      const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';
      // ==========================================================================================

      console.log(`[useTradingBot - ${networkType}] Bot llamando al endpoint de trade: ${endpoint}`);
      console.log(`[useTradingBot - ${networkType}] Datos de la orden:`, JSON.stringify(orderData));

      let tradeResult: any = null;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData), // Enviar el objeto compatible con TradeRequest del backend
        });

        console.log(`[useTradingBot - ${networkType}] Respuesta del endpoint ${endpoint} recibida. Estado: ${response.status}`);
        tradeResult = await response.json();
        console.log(`[useTradingBot - ${networkType}] Resultado parseado de la orden del bot:`, tradeResult);

        if (!response.ok || !tradeResult.success) {
          const errorMsg = tradeResult?.message || tradeResult?.details || `Error HTTP ${response.status} al colocar orden.`;
          console.error(`[useTradingBot - ${networkType}] Endpoint ${endpoint} reportó error: ${errorMsg}. Respuesta completa:`, tradeResult);
          setPlaceOrderError(tradeResult || { message: `Error HTTP: ${response.status}` });
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: tradeResult });
          toast({ title: `Bot: Error Orden (${networkType})`, description: `Error al colocar orden en ${selectedMarket?.symbol}: ${errorMsg}`, variant: "destructive", duration: 10000 });
        } else {
          console.log(`[useTradingBot - ${networkType}] Orden del bot procesada con éxito por el backend. Order ID: ${tradeResult.orderId}, Estado: ${tradeResult.status}`);
          setBotLastActionTimestamp(Date.now());
          if (onBotAction) onBotAction({ type: 'orderPlaced', success: true, details: tradeResult });

          const executedQty = parseFloat(tradeResult.filled || tradeResult.amount || '0'); // CCXT `filled` o `amount`
          const executedPrice = parseFloat(tradeResult.price || currentPrice.toString()); // CCXT `price` o precio actual

          if (action === 'buy') {
            console.log(`[useTradingBot - ${networkType}] Actualizando posición simulada: COMPRA.`);
            setBotOpenPosition({
              marketId: selectedMarket.id,
              entryPrice: executedPrice,
              amount: executedQty,
              type: 'buy',
              timestamp: Math.floor((tradeResult.timestamp || Date.now()) / 1000), // CCXT `timestamp`
            });
            toast({ title: `Bot: Compra Ejecutada (${networkType})`, description: `Orden de ${executedQty.toFixed(amountPrecision)} ${baseAsset} en ${selectedMarket.symbol} a ~$${executedPrice.toFixed(quotePrecision)}.`, variant: "default" });
          } else if (action === 'sell') {
            console.log(`[useTradingBot - ${networkType}] Actualizando posición simulada: VENTA.`);
            if (botOpenPosition?.type === 'buy' && botOpenPosition.marketId === selectedMarket.id) {
              const pnl = (executedPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
              console.log(`[useTradingBot - ${networkType}] PnL simulado (cierre de posición): ${pnl.toFixed(quotePrecision)} ${quoteAsset}.`);
              toast({ title: `Bot: Posición Cerrada (${networkType})`, description: `P&L: ${pnl.toFixed(quotePrecision)} ${quoteAsset}`, variant: "default" });
            }
            setBotOpenPosition(null);
            toast({ title: `Bot: Venta Ejecutada (${networkType})`, description: `Orden de ${executedQty.toFixed(amountPrecision)} ${baseAsset} en ${selectedMarket.symbol} a ~$${executedPrice.toFixed(quotePrecision)}.`, variant: "default" });
          }
        }
      } catch (fetchError: any) {
        const errorDetails = { message: `Error de red o cliente al colocar orden en ${networkType}.`, details: fetchError.message };
        console.error(`[useTradingBot - ${networkType}] Error en fetch a ${endpoint}:`, fetchError);
        setPlaceOrderError(errorDetails);
        if (onBotAction) onBotAction({ type: 'orderPlaced', success: false, details: errorDetails });
        toast({ title: `Bot: Error Conexión (${networkType})`, description: `No se pudo comunicar para orden en ${selectedMarket?.symbol}. Detalles: ${errorDetails.details}`, variant: "destructive", duration: 10000 });
      } finally {
        setIsPlacingOrder(false);
        console.log(`[useTradingBot - ${networkType}] Finalizada la lógica de colocación de orden.`);
      }
    }
    // ==========================================================================================
    // FIN: Lógica de Estrategia del Bot y Colocación de Órdenes
    // ==========================================================================================
  }, [
    isBotRunning,
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice,
    allBinanceBalances,
    botLastActionTimestamp,
    botOpenPosition,
    toast,
    useTestnet, // Importante: useTestnet es una dependencia
    onBotAction
  ]);

  useEffect(() => {
    const networkTypeLog = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useTradingBot - LifecycleEffect - ${networkTypeLog}] Estado: ${isBotRunning ? 'CORRIENDO' : 'DETENIDO'}. Mercado: ${selectedMarket?.symbol || 'NINGUNO'}.`);
    
    let intervalId: NodeJS.Timeout | null = null;

    if (isBotRunning && selectedMarket) {
      console.log(`[useTradingBot - LifecycleEffect - ${networkTypeLog}] Iniciando bot para ${selectedMarket.symbol}. Intervalo: ${botIntervalMs / 1000}s.`);
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
      }
      executeBotStrategy(); // Ejecución inmediata al iniciar/cambiar mercado con bot activo
      intervalId = setInterval(executeBotStrategy, botIntervalMs);
      botIntervalRef.current = intervalId;
    } else {
      if (botIntervalRef.current) {
        console.log(`[useTradingBot - LifecycleEffect - ${networkTypeLog}] Bot detenido o sin mercado. Limpiando intervalo.`);
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    }
    return () => { // Función de limpieza
      console.log(`[useTradingBot - LifecycleEffect - ${networkTypeLog}] Limpiando efecto (desmontaje o cambio de dependencias).`);
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (botIntervalRef.current) { // Asegurar limpieza si el intervalo se asignó fuera del ciclo de este efecto
          clearInterval(botIntervalRef.current)
          botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy, useTestnet]); // useTestnet aquí asegura que si cambia, el bot se reinicie con la nueva config.

  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      const networkTypeToast = useTestnet ? 'Testnet' : 'Mainnet';
      console.log(`[useTradingBot - toggleBotStatus] Cambiando estado del bot a: ${newStatus} para operaciones en ${networkTypeToast}.`);
      setTimeout(() => {
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"}`,
          description: `Bot de trading ahora ${newStatus ? "activo" : "inactivo"} para ${selectedMarket?.symbol || 'mercado actual'} en ${networkTypeToast}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast, selectedMarket, useTestnet]); // useTestnet para el mensaje del toast

  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder,
    placeOrderError,
  };
};
