// src/hooks/useTradingBot.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Market, MarketPriceDataPoint, OrderFormData, SimulatedPosition } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"; // Si el hook usará toasts

interface UseTradingBotProps {
  selectedMarket: Market | null;
  currentMarketPriceHistory: MarketPriceDataPoint[];
  currentPrice: number | null; // El precio actual más reciente
  allBinanceBalances: Record<string, { available: string; onOrder: string }> | null;
 onPlaceOrder: (orderData: OrderFormData, isBotOrder: boolean) => Promise<boolean>; // Función para ejecutar órdenes
  botIntervalMs?: number; // Intervalo de ejecución del bot en ms
}

interface UseTradingBotReturn {
  isBotRunning: boolean;
  toggleBotStatus: () => void;
  botOpenPosition: SimulatedPosition | null;
  botLastActionTimestamp: number;
}

export const useTradingBot = ({
  selectedMarket,
  currentMarketPriceHistory,
  currentPrice,
  allBinanceBalances,
  onPlaceOrder,
  botIntervalMs = 15000 // Valor por defecto: cada 15 segundos
}: UseTradingBotProps): UseTradingBotReturn => {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botOpenPosition, setBotOpenPosition] = useState<SimulatedPosition | null>(null);
  const [botLastActionTimestamp, setBotLastActionTimestamp] = useState<number>(0);
  const botIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Mínimo 5 segundos entre acciones reales del bot para evitar spam de órdenes
  const BOT_MIN_ACTION_INTERVAL_MS = 5000;

  // --- Lógica principal de la estrategia del bot ---
  const executeBotStrategy = useCallback(async () => {
    if (!selectedMarket || !currentPrice || currentPrice <= 0 || currentMarketPriceHistory.length < 20) {
      console.warn("[Bot Strategy] Datos insuficientes para ejecutar la estrategia.");
      return;
    }

    // Evitar acciones muy rápidas si el bot ya operó recientemente
    if (Date.now() - botLastActionTimestamp < BOT_MIN_ACTION_INTERVAL_MS) {
      console.log("[Bot Strategy] Esperando intervalo mínimo entre acciones.");
      return;
    }

    console.log(`[Bot Strategy] Analizando ${selectedMarket.name} a precio: ${currentPrice}`);

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
    }

    // --- Estrategia de MACD (ejemplo) ---
    // Puedes añadir más lógica de decisión o combinar indicadores aquí
    if (action === 'hold' && latestPriceDataPoint.macdHistogram !== undefined &&
        previousPriceDataPoint.macdHistogram !== undefined) {
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
    }


    console.log(`[Bot Decision] ${selectedMarket.symbol}: ${action.toUpperCase()} por: ${triggerReason}`);

    // --- Ejecutar la orden si se decide una acción ---
    if (action !== 'hold') {
      let tradeAmount = 0;
      // Determinar la cantidad a operar. Puedes usar un porcentaje de tu balance.
      // Aquí usamos el balance de quoteAsset (ej. USDT) para compras y baseAsset (ej. BTC) para ventas.

      if (action === 'buy' && allBinanceBalances && allBinanceBalances[selectedMarket.quoteAsset]) {
        const availableQuote = parseFloat(allBinanceBalances[selectedMarket.quoteAsset].available);
        const investmentPercentage = 0.05; // Invertir 5% del balance disponible
        const desiredQuoteAmount = availableQuote * investmentPercentage;
        tradeAmount = parseFloat((desiredQuoteAmount / currentPrice).toFixed(selectedMarket.amountPrecision || 6));
      } else if (action === 'sell' && botOpenPosition && allBinanceBalances && allBinanceBalances[selectedMarket.baseAsset]) {
        // Si hay una posición abierta del bot, intenta cerrarla completamente
        tradeAmount = botOpenPosition.amount;
      }

      if (tradeAmount <= 0) {
        console.warn(`[Bot Action] Cantidad de trade calculada fue <= 0 para ${action} ${selectedMarket.symbol}. Saltando.`);
        return;
      }

      const orderData: OrderFormData = {
        marketId: selectedMarket.id,
        type: action,
        amount: tradeAmount,
        orderType: 'market', // O 'limit' si quieres ser más avanzado
        price: currentPrice // Para órdenes de mercado, este es el precio de referencia
      };

      // Gestión de posiciones (simulada por ahora)
      if (action === 'buy' && !botOpenPosition) {
        const success = onPlaceOrder(orderData, true); // True indica que es una orden del bot
        if (await success) {
          setBotOpenPosition({
            marketId: selectedMarket.id,
            entryPrice: currentPrice,
            amount: tradeAmount,
            type: 'buy',
            timestamp: Math.floor(Date.now() / 1000)
          });
          setBotLastActionTimestamp(Date.now());
          toast({
            title: "Bot Ejecutó Compra (Sim.)",
            description: `Comprados ${tradeAmount.toFixed(selectedMarket.baseAsset === 'BTC' ? 4 : 2)} ${selectedMarket.baseAsset} a $${currentPrice.toFixed(selectedMarket.quoteAsset === 'USDT' ? 2 : 5)} (${triggerReason})`,
            variant: "default",
            duration: 5000
          });
        }
      } else if (action === 'sell' && botOpenPosition && botOpenPosition.marketId === selectedMarket.id) {
        const success = await onPlaceOrder(orderData, true); // True indica que es una orden del bot
        if (success) {
          // Calcular PnL de la posición cerrada
          let pnl = (currentPrice - botOpenPosition.entryPrice) * botOpenPosition.amount;
          const pnlMessage = pnl >= 0 ? `Ganancia: +${pnl.toLocaleString('en-US', { style: 'currency', currency: selectedMarket.quoteAsset })}` : `Pérdida: ${pnl.toLocaleString('en-US', { style: 'currency', currency: selectedMarket.quoteAsset })}`;

          setBotOpenPosition(null);
          setBotLastActionTimestamp(Date.now());
          toast({
            title: "Bot Ejecutó Venta (Sim.)",
            description: `Vendidos ${tradeAmount.toFixed(selectedMarket.baseAsset === 'BTC' ? 4 : 2)} ${selectedMarket.baseAsset} a $${currentPrice.toFixed(selectedMarket.quoteAsset === 'USDT' ? 2 : 5)} (${triggerReason}). ${pnlMessage}`,
            variant: "default",
            duration: 5000
          });
        }
      }
    }
  }, [
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice,
    allBinanceBalances,
    onPlaceOrder,
    botLastActionTimestamp,
    botOpenPosition,
    toast,
  ]);

  // --- Efecto para controlar el ciclo de vida del bot ---
  useEffect(() => {
    if (isBotRunning) {
      console.log(`[useTradingBot] Bot iniciado para ${selectedMarket?.symbol}. Intervalo: ${botIntervalMs / 1000}s`);
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
      }
      executeBotStrategy(); // Ejecución inicial al iniciar
      botIntervalRef.current = setInterval(executeBotStrategy, botIntervalMs);
    } else {
      if (botIntervalRef.current) {
        console.log("[useTradingBot] Bot detenido. Limpiando intervalo.");
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    }

    return () => {
      if (botIntervalRef.current) {
        console.log("[useTradingBot] Limpiando intervalo del bot (desmontaje).");
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket, botIntervalMs, executeBotStrategy]);

  const toggleBotStatus = useCallback(() => {
    setIsBotRunning(prev => {
      const newStatus = !prev;
      setTimeout(() => { // Defer toast to avoid state update warning
        toast({
          title: `Bot ${newStatus ? "Iniciado" : "Detenido"}`,
          description: `El bot de trading ahora está ${newStatus ? "activo (simulación)" : "inactivo (simulación)"}.`,
          variant: newStatus ? "default" : "destructive",
        });
      }, 0);
      return newStatus;
    });
  }, [toast]);

  return {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp
  };
};