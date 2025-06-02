// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
// src/app/page.tsx

// Importaciones de TIPOS (usa 'type')
import type {
  AISignalData,
  Market,
  OrderFormData,
  Trade,
  MarketPriceDataPoint,
  SignalEvent,
  SimulatedPosition,
  ParsedSignals,
  SignalItem,
  SmaCrossoverEvent
} from "@/lib/types";


// Importaciones de VALORES (NO uses 'type')
// Importaciones de VALORES (NO uses 'type')
import { exampleHistoricalDataForAI, PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types";

// ... el resto de tus importaciones ...// Asegúrate de importar 'Market' ya que lo usaremos en el estado y el useEffect
// Componentes UI
import { AppHeader } from "@/components/dashboard/header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TradeHistoryTable } from "@/components/dashboard/trade-history-table";
import { BotControls } from "@/components/dashboard/bot-controls";
import { SignalDisplay } from "@/components/dashboard/signal-display";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { MarketSelector } from "@/components/trading/market-selector";
import { MarketPriceChart } from "@/components/trading/market-price-chart";
import TradeForm from '@/components/trading/TradeForm'; 

import { handleGenerateSignalsAction } from "./actions";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, PackageSearch, Info, TrendingUp, TrendingDown, WalletCards, BotIcon, BookOpen, Activity, Wallet, DollarSign } from "lucide-react";

//                                                                                                                              ^^^^^^^^^ -- Añade DollarSign aquí

// Hooks y acciones
import { useToast } from "@/hooks/use-toast";
import { useBinanceMarketData } from "@/hooks/useBinanceMarketData";
import type { GenerateTradingSignalsInput } from "@/ai/flows/generate-trading-signals";

// Componentes de visualización de Binance (si los usas)
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display'; // <-- Ya estaba importado


// NUEVA IMPORTACIÓN DEL HOOK DEL BOT
import { useTradingBot } from '@/hooks/useTradingBot';

// --- Definir las interfaces necesarias aquí mismo para mayor claridad ---
interface Balance {
  available: string;
  onOrder: string;
}

interface BalancesResponse {
  message: string;
  balances: Record<string, Balance>;
}
// --- Fin de interfaces ---

const MAX_AI_SIGNAL_EVENTS_ON_CHART = 5;
const AI_TRADE_CONFIDENCE_THRESHOLD = 0.01;
const BOT_AUTO_SIGNAL_INTERVAL_MS = 30000;

const isValidSignalItem = (item: any): item is SignalItem => {
  return typeof item === 'object' && item !== null &&
    typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
    typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
};

function SimulatedPnLDisplay({ position, currentPrice, market }: { position: SimulatedPosition | null; currentPrice: number | null; market: Market | null }) {
                                                                                       // ^^^^^^^^^^^^^^^^  <-- CAMBIO 1: Tipo de 'currentPrice'
  if (!position || currentPrice === null || !market) {
                               // ^^^^^^^^^^^^^^^^  <-- CAMBIO 2: Comprobación de 'currentPrice'
    return (
      <Card className="mt-4">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm flex items-center">
            <WalletCards className="w-4 h-4 mr-2 text-muted-foreground" />
            P&L Posición Abierta (Sim.)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground pb-3">
          No hay posición abierta simulada o datos de precio insuficientes.
        </CardContent>
      </Card>
    );
  }

  let pnl = 0;
  let pnlPercentage = 0;
  const quoteAsset = market.quoteAsset;

  if (position.type === 'buy') {
    pnl = (currentPrice - position.entryPrice) * position.amount;
  } else {
    pnl = (position.entryPrice - currentPrice) * position.amount;
  }

  const costOfPosition = position.entryPrice * position.amount;
  if (costOfPosition !== 0) {
    pnlPercentage = (pnl / costOfPosition) * 100;
  }

  const pnlColor = pnl >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <Card className="mt-4 shadow-md">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center">
          {position.type === 'buy' ? <TrendingUp className="w-4 h-4 mr-2 text-green-500" /> : <TrendingDown className="w-4 h-4 mr-2 text-red-500" />}
          P&L Posición {market.baseAsset} (Sim.)
        </CardTitle>
        <CardDescription className="text-xs">
          Entrada: ${position.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} | Cant.: {position.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 pb-3">
        <p className={`font-semibold text-lg ${pnlColor}`}>
          {pnl.toLocaleString('en-US', { style: 'currency', currency: quoteAsset, minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className={`ml-2 text-xs ${pnlColor}`}>({pnlPercentage.toFixed(2)}%)</span>
        </p>
        <p className="text-xs text-muted-foreground">Precio Actual: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}</p>
      </CardContent>
    </Card>
  );
}

export default function TradingPlatformPage() {
  // 1. TODAS LAS DECLARACIONES DE ESTADO (useState) Y REFERENCIAS (useRef) PRIMERO Y AGRUPADAS
  const [selectedMarket, setSelectedMarket] = useState<Market>({
    id: "BTCUSDT",
    symbol: "BTCUSDT",
    name: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    latestPrice: null
  });

  // RENOMBRADO DE ESTADOS: Mantener el tipo original 'AISignalData' por ahora.
  const [botSignalData, setBotSignalData] = useState<AISignalData | null>(null); // ¡CAMBIO AQUÍ! Usa AISignalData
  const [botError, setBotError] = useState<string | null>(null);
  const [isLoadingBotSignals, setIsLoadingBotSignals] = useState(false);
  const [botSignalEvents, setBotSignalEvents] = useState<SignalEvent[]>([]); // ¡CAMBIO AQUÍ! Usa SignalEvent

  const [availableQuoteBalance, setAvailableQuoteBalance] = useState<number | null>(null);
  const [currentBaseAssetBalance, setCurrentBaseAssetBalance] = useState<number>(0);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);

  const [smaCrossoverEvents, setSmaCrossoverEvents] = useState<SmaCrossoverEvent[]>([]); // <-- ¡AHORA ESTÁ AQUÍ!

  const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
  const [currentSimulatedPosition, setCurrentSimulatedPosition] = useState<SimulatedPosition | null>(null);

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  // ESTADO CLAVE PARA EL BOT
  //const [isBotRunning, setIsBotRunning] = useState<boolean>(false); // <--- ¡ÚNICA DECLARACIÓN AQUÍ!
  
  const botIntervalRef = useRef<number | null>(null);
  const marketPriceUpdateIntervalRef = useRef<number | null>(null);
  
  
  // Estados para Balances de Binance
  const [binanceUSDTBalance, setBinanceUSDTBalance] = useState<number | null>(null);
  const [isBinanceBalancesLoading, setIsBinanceBalancesLoading] = useState(true);
  const [binanceBalancesError, setBinanceBalancesError] = useState<string | null>(null);
  const [allBinanceBalances, setAllBinanceBalances] = useState<Record<string, Balance>>({});
  const [isLoadingTrade, setIsLoadingTrade] = useState(false);



  // ======================================================================
  // 2. LLAMADAS A HOOKS DE UTILIDAD Y HOOKS PERSONALIZADOS
  //    (Estos hooks se ejecutan ANTES que los useCallback o useEffect que los utilicen.
  //     Definen valores clave como `currentMarketPrice`, `isBotRunning`, etc.)
  // ======================================================================


  // 2. DESPUÉS DE TODOS LOS ESTADOS: LLAMADAS A HOOKS PERSONALIZADOS
  // useBinanceMarketData debe ir aquí, ya que usa 'selectedMarket' que está definido arriba.
  // Hooks de utilidades (como useToast)
  const { toast } = useToast();

  const {
    marketPrice: currentMarketPrice,
    marketHistory: currentMarketHistory,
    availableMarkets,
    isLoading: isMarketDataLoading,
    error: marketDataError
  } = useBinanceMarketData({
    symbol: selectedMarket.id,
    timeframe: "1m",
    limit: PRICE_HISTORY_POINTS_TO_KEEP // Usa la constante importada
  });

  

  // MUEVE ESTA SECCIÓN AQUÍ:
  // 3. Función handlePlaceOrder (debe estar definida antes de useTradingBot)
  // c) handlePlaceOrder (¡AJUSTE CLAVE AQUÍ: DEFINIR handlePlaceOrder ANTES DE useTradingBot!)
  //    `useTradingBot` lo necesita como dependencia, así que debe existir antes de la llamada al hook.
  const handlePlaceOrder = useCallback(
    async (orderData: OrderFormData, isBotSimulated: boolean = false): Promise<boolean> => {
      setIsLoadingTrade(true);
      let success = false;
      let priceToUse = orderData.price;

      // Determinar el precio para la orden de mercado si es necesario
      if (orderData.orderType === 'market') {
        if (selectedMarket.id === "BTCUSDT" && currentMarketPrice !== null) {
          priceToUse = currentMarketPrice;
        } else if (currentMarketPriceHistory.length > 0) {
          priceToUse = currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price;
        } else {
          priceToUse = selectedMarket.latestPrice || 0;
        }
      }

      if (!priceToUse || priceToUse <= 0) {
        const errorMsg = "No se pudo determinar un precio válido para la orden.";
        console.error(`[handlePlaceOrder] Error: ${errorMsg}`, { orderData, currentMarketPrice, currentMarketPriceHistory });
        if (!isBotSimulated) {
          toast({ title: "Error de Precio", description: errorMsg, variant: "destructive" });
        }
        setIsLoadingTrade(false);
        return false;
      }
      orderData.price = priceToUse; // Asegurarse de que el precio usado esté en orderData

      try {
        // Aquí iría la lógica REAL para enviar la orden a Binance usando fetch
        console.log(`[handlePlaceOrder] Enviando orden REAL a Binance:`, orderData);
        const response = await fetch('/api/binance/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error al enviar orden a Binance: ${errorData.message || response.statusText}`);
        }

        const result = await response.json();
        console.log(`[handlePlaceOrder] Orden REAL exitosa:`, result);
        success = true; // La orden fue enviada exitosamente (no necesariamente ejecutada de inmediato si es Limit)

      } catch (error: any) {
        console.error(`[handlePlaceOrder] Fallo al enviar orden REAL:`, error);
        const errorMessage = error.message || "Ocurrió un error desconocido al enviar la orden.";
        if (!isBotSimulated) {
          toast({
            title: "Error de Orden (Binance)",
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
        }
      } finally {
        setIsLoadingTrade(false); // Finaliza el estado de carga
      }
      return success;
    },
    [
      currentMarketPrice,
      currentMarketPriceHistory,
      selectedMarket,
      toast,
      // No se usan directamente: availableQuoteBalance, currentBaseAssetBalance, tradeHistory
      // setIsLoadingTrade es estable.
    ]
  );







  // d) useTradingBot (¡AJUSTE CLAVE AQUÍ: ESTE ES EL ORDEN CORRECTO para useTradingBot!)
  //    Debe ir DESPUÉS de `useBinanceMarketData` y `handlePlaceOrder`
  //    porque usa `currentMarketPrice`, `currentMarketPriceHistory`, `allBinanceBalances`, y `handlePlaceOrder`.
  //    Aquí es donde `isBotRunning` y `toggleBotStatus` son "declaradas" para el componente.
  


  // NUEVA LÍNEA: Usa el hook useTradingBot
  const {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp
  } = useTradingBot({
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice: currentMarketPrice, // <-- ¡AJUSTE CLAVE AQUÍ: Usar currentMarketPrice!
    allBinanceBalances,
    onPlaceOrder: handlePlaceOrder, // Pasa tu función existente para manejar órdenes
    botIntervalMs: 15000 // Ejecutar la estrategia cada 15 segundos (ajusta si quieres)
  });


  // ======================================================================
  // 3. DECLARACIONES DE FUNCIONES useCallback/useMemo
  //    (Estas funciones dependen de estados o valores de hooks declarados ANTERIORMENTE.
  //     También deben estar DEFINIDAS ANTES de cualquier `useEffect` que las llame.)
  // ======================================================================


  // a) clearSignalData: No depende de isBotRunning, pero debe estar antes de handleSignalsGenerated
  const clearSignalData = useCallback(() => {
    setBotSignalData(null);
    setBotError(null);
    setBotSignalEvents([]);
    setSmaCrossoverEvents([]);
  }, [setBotSignalData, setBotError, setBotSignalEvents, setSmaCrossoverEvents]);



  // b) handleGenerationError
  const handleGenerationError = useCallback((errorMsg: string, isAutoCall: boolean = false) => {
    setBotSignalData(null);
    setBotError(errorMsg);
    if (!isAutoCall) {
      toast({ title: "Error al Generar Señales del Bot", description: errorMsg, variant: "destructive" });
    } else {
      console.error("Error en ciclo automático del Bot:", errorMsg);
      toast({ title: "Error en Ciclo del Bot", description: `Fallo al analizar ${selectedMarket.name}. Revise la consola.`, variant: "destructive", duration: 3000 });
    }
  }, [setBotSignalData, setBotError, selectedMarket.name, toast]);




  // c) handleSignalsGenerated (Depende de handlePlaceOrder, currentMarketPriceHistory, etc.)
  const handleSignalsGenerated = useCallback((data: AISignalData, isAutoCall: boolean = false) => {
    setBotSignalData(data);
    setBotError(null);

    let operationsExecutedByBot = 0;
    let parsedSignalsArray: ParsedSignals | null = null;

    try {
      const rawParsed = JSON.parse(data.signals);
      if (Array.isArray(rawParsed) && (rawParsed.length === 0 || rawParsed.every(isValidSignalItem))) {
        parsedSignalsArray = rawParsed as ParsedSignals;
      } else {
        let errorDetail = "Los datos de señales de la estrategia del bot no son un array válido de objetos de señal.";
        if (Array.isArray(rawParsed) && rawParsed.length > 0 && !rawParsed.every(isValidSignalItem)) {
          errorDetail = "Uno o más objetos de señal tienen un formato incorrecto.";
        }
        console.error("Error al analizar señales JSON del bot:", errorDetail, "Datos recibidos:", data.signals);
        if (!isAutoCall) {
          toast({ title: "Error de Formato de Señal del Bot", description: errorDetail, variant: "destructive" });
        }
        return;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Formato de señales JSON inesperado.";
      console.error("Error al analizar señales JSON del bot (catch):", errorMsg, "Datos recibidos:", data.signals);
      if (!isAutoCall) {
        toast({ title: "Error de Formato de Señal del Bot (catch)", description: errorMsg, variant: "destructive" });
      }
      return;
    }

    if (isAutoCall) console.log("Señales del bot recibidas (ciclo automático):", parsedSignalsArray);

    const latestPriceDataPoint = currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1] : null;
    // <-- AJUSTE CLAVE AQUÍ: Usa `currentMarketPrice` si está disponible y es válido, si no, usa el historial.
    const currentMarketPriceForBot = selectedMarket.id === "BTCUSDT" && currentMarketPrice && currentMarketPrice > 0
      ? currentMarketPrice
      : (latestPriceDataPoint ? latestPriceDataPoint.price : undefined);

    if (parsedSignalsArray && currentMarketPriceForBot && currentMarketPriceForBot > 0) {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const newEvents: SignalEvent[] = parsedSignalsArray
        .filter(s => s.signal === 'BUY' || s.signal === 'SELL')
        .map(s => ({
          timestamp: currentTimestamp,
          price: currentMarketPriceForBot,
          type: s.signal as 'BUY' | 'SELL',
          confidence: s.confidence,
        }));
      setBotSignalEvents(prevEvents => [...prevEvents, ...newEvents].slice(-MAX_AI_SIGNAL_EVENTS_ON_CHART));

      for (const signal of parsedSignalsArray) {
        if ((signal.signal === 'BUY' || signal.signal === 'SELL') && signal.confidence >= AI_TRADE_CONFIDENCE_THRESHOLD) {
          let tradeAmount = 0.001; // Placeholder. Must be replaced by real logic.

          if (tradeAmount <= 0) {
            console.warn(`Bot (auto cycle): Calculated trade amount was <= 0 for ${signal.signal} ${selectedMarket.baseAsset}. Skipping.`);
            continue;
          }

          console.log(`Bot (auto cycle): Attempting to execute trade: ${signal.signal} ${tradeAmount.toFixed(6)} ${selectedMarket.baseAsset} @ ${currentMarketPriceForBot.toFixed(5)} (Conf: ${signal.confidence.toFixed(2)})`);
          const realOrder: OrderFormData = {
            type: signal.signal === 'BUY' ? 'buy' : 'sell',
            marketId: selectedMarket.id,
            amount: tradeAmount,
            orderType: 'market',
            price: currentMarketPriceForBot
          };

          const success = handlePlaceOrder(realOrder, true); // Pass 'true' to indicate it's from the bot
          if (success) {
            operationsExecutedByBot++;
            console.log(`Bot (auto cycle): Executed a ${signal.signal} trade of ${tradeAmount.toFixed(6)} ${selectedMarket.baseAsset} with confidence ${signal.confidence.toFixed(2)}`);
            if (isAutoCall) {
              toast({
                title: `Bot Executed ${signal.signal === 'BUY' ? 'Buy' : 'Sell'} Successfully`,
                description: `${signal.signal === 'BUY' ? 'Bought' : 'Sold'} ${tradeAmount.toFixed(6)} ${selectedMarket.baseAsset} at $${currentMarketPriceForBot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5 })} (Confidence: ${(signal.confidence * 100).toFixed(0)}%)`,
                variant: "default"
              });
            }
          } else {
            console.warn(`Bot (auto cycle): Attempted to execute a ${signal.signal} trade of ${tradeAmount.toFixed(6)} ${selectedMarket.baseAsset} but failed (e.g., insufficient funds or API error).`);
            if (isAutoCall) {
              toast({
                title: `Bot Attempted ${signal.signal === 'BUY' ? 'Buy' : 'Sell'} (Failed)`,
                description: `Could not execute the operation for ${tradeAmount.toFixed(6)} ${selectedMarket.baseAsset}. (Confidence: ${(signal.confidence * 100).toFixed(0)}%)`,
                variant: "destructive",
                duration: 3000
              });
            }
          }
        }
      }
    }

    if (isAutoCall && operationsExecutedByBot === 0) {
      if (!currentMarketPriceForBot || currentMarketPriceForBot <= 0) {
        console.log(`Bot Auto Cycle: No operation executed. (No current price or price <= 0). Number of signals processed: ${parsedSignalsArray?.length ?? 'N/A'}.`);
      } else if (!parsedSignalsArray || parsedSignalsArray.length === 0) {
        console.log(`Bot Auto Cycle: No operation executed. Strategy returned no valid signals or empty array.`);
        toast({ title: `Bot Cycle: ${selectedMarket.name}`, description: `Analysis complete, strategy identified no specific signals.`, variant: "default", duration: 5000 });
      } else {
        const highestConfidenceSignal = parsedSignalsArray.reduce((max, s) => s.confidence > max.confidence ? s : max, parsedSignalsArray[0]);
        if (parsedSignalsArray.every(s => s.signal === 'HOLD' || s.confidence < AI_TRADE_CONFIDENCE_THRESHOLD)) {
          console.log(`Bot Auto Cycle: No operation executed. Highest confidence signal: ${highestConfidenceSignal.signal} with ${highestConfidenceSignal.confidence.toFixed(2)}. (Threshold needed: ${AI_TRADE_CONFIDENCE_THRESHOLD} for BUY/SELL)`);
          toast({ title: `Bot Cycle: ${selectedMarket.name}`, description: `Analysis complete, no new high-confidence operations. Main signal: ${highestConfidenceSignal.signal} (${(highestConfidenceSignal.confidence * 100).toFixed(0)}%)`, variant: "default", duration: 5000 });
        } else {
          const actionableSignals = parsedSignalsArray.filter(s => s.signal === 'BUY' || s.signal === 'SELL');
          if (actionableSignals.length > 0) {
            const bestActionable = actionableSignals.reduce((max, s) => s.confidence > max.confidence ? s : max, actionableSignals[0]);
            console.log(`Bot Auto Cycle: No operation executed. Best actionable signal ${bestActionable.signal} with confidence ${bestActionable.confidence.toFixed(2)} did not meet threshold ${AI_TRADE_CONFIDENCE_THRESHOLD}.`);
          }
        }
      }
    }
  }, [setBotSignalData, setBotError, setBotSignalEvents, currentMarketPriceHistory, selectedMarket, currentMarketPrice, toast, handlePlaceOrder]);





// src/app/page.tsx
// ... (código anterior) ...

  const generateSignalsActionWrapper = async (input: GenerateTradingSignalsInput, isAutoCall: boolean = false) => {
    // CAMBIO DE NOMBRES DE ESTADOS Y TEXTOS PARA REFERIRSE AL BOT
    if (!isAutoCall) {
      setIsLoadingBotSignals(true); // <--- Asumo que has renombrado isLoadingAiSignals
      setBotError(null);           // <--- Asumo que has renombrado setAiError
      setBotSignalData(null);      // <--- Asumo que has renombrado setAiSignalData
    } else if (isLoadingBotSignals && isAutoCall) { // <--- Asumo que has renombrado isLoadingAiSignals
      console.log("Ciclo automático del Bot: Solicitud de generación de señales ya en curso. Saltando este ciclo.");
      return;
    }

    try {
      const completeInput = { ...input, cryptocurrencyForAI: input.cryptocurrencyForAI || selectedMarket.baseAsset };
      const result = await handleGenerateSignalsAction(completeInput); // Esta es la Server Action
      if (!result || typeof result.signals !== 'string' || typeof result.explanation !== 'string') {
        console.error("Respuesta de la estrategia del bot inválida (faltan signals/explanation strings):", result);
        throw new Error("La respuesta de la estrategia del bot no tiene la estructura esperada.");
      }
      handleSignalsGenerated(result, isAutoCall); // Esta función debería usar ahora los nuevos estados botSignalData, etc.
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido al generar señales.";
      console.error("Error en generateSignalsActionWrapper:", errorMessage, error);
      handleGenerationError(errorMessage, isAutoCall);
    } finally {
      setIsLoadingBotSignals(false); // <--- Asumo que has renombrado setIsLoadingAiSignals
    }
  };


  // ======================================================================
  // 4. TODOS LOS EFECTOS (useEffect)
  //    (Ahora 'isBotRunning' y 'generateSignalsActionWrapper' ya estarán definidas
  //     porque `useTradingBot` y `useCallback` ya se ejecutaron.)
  // ======================================================================



useEffect(() => {
    if (isBotRunning) {
      console.log("Bot activado. Iniciando ciclo automático de señales...");
      // Ejecuta inmediatamente al iniciar
      generateSignalsActionWrapper({
        cryptocurrencyForAI: selectedMarket.baseAsset,
        historicalData: JSON.stringify(currentMarketHistory), // <-- ¡AÑADE ESTO!
        strategy: "movingAverage", // <-- ¡AÑADE ESTO o tu estrategia preferida!
        riskLevel: "medium" // <-- ¡AÑADE ESTO o tu nivel de riesgo preferido!
      }, true);

      // Luego, configura el intervalo
      botIntervalRef.current = setInterval(() => {
        generateSignalsActionWrapper({
          cryptocurrencyForAI: selectedMarket.baseAsset,
          historicalData: JSON.stringify(currentMarketHistory), // <-- ¡AÑADE ESTO!
          strategy: "movingAverage", // <-- ¡AÑADE ESTO o tu estrategia preferida!
          riskLevel: "medium" // <-- ¡AÑADE ESTO o tu nivel de riesgo preferido!
        }, true);
      }, BOT_AUTO_SIGNAL_INTERVAL_MS) as unknown as number;

    } else {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
        console.log("Bot detenido. Deteniendo ciclo automático de señales.");
      }
    }

    // Función de limpieza para cuando el componente se desmonte o isBotRunning cambie a false
    return () => {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    };
  }, [isBotRunning, selectedMarket.baseAsset, generateSignalsActionWrapper, currentMarketHistory]); // <--- ¡Asegúrate de agregar currentMarketHistory aquí!
  
  // --- NUEVO useEffect para cargar los balances de Binance ---
  useEffect(() => {
    const fetchBinanceBalances = async () => {
      setIsBinanceBalancesLoading(true); // Iniciamos la carga
      setBinanceBalancesError(null); // Limpiamos errores anteriores

      try {
        const response = await fetch('/api/binance/balance'); // ¡Llamada a tu API de Binance!
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error HTTP ${response.status}: ${errorData.message || 'Error desconocido al obtener balances'}`);
        }
        const data: BalancesResponse = await response.json();

        setAllBinanceBalances(data.balances); // Guardamos todos los balances
        
        // Extraer y parsear el balance de USDT
        if (data.balances['USDT']) {
          setBinanceUSDTBalance(parseFloat(data.balances['USDT'].available));
        } else {
          setBinanceUSDTBalance(0); // Si no hay USDT, asumimos 0
        }

      } catch (err: any) {
        console.error("[Page] Error al cargar balances de Binance:", err);
        setBinanceBalancesError(err.message);
        setBinanceUSDTBalance(null); // Establecer balance a null en caso de error
      } finally {
        setIsBinanceBalancesLoading(false); // Finalizamos la carga
      }
    };

    fetchBinanceBalances(); // Ejecutar la función cuando el componente se monte
    // Opcional: Si quieres actualizar los balances periódicamente, puedes añadir un setInterval aquí
    // const interval = setInterval(fetchBinanceBalances, 60000); // Cada 60 segundos
    // return () => clearInterval(interval); // Limpiar el intervalo al desmontar
  }, []); // El array vacío asegura que esto se ejecute solo una vez al inicio
































  // MUEVE ESTA SECCIÓN AQUÍ:
  // 4. `useMemo` para `latestPriceForPnl` (debe estar definido antes de useTradingBot)
  const latestPriceForPnl = useMemo(() => {
    if (selectedMarket.id === "BTCUSDT" && currentMarketPrice !== null) {
      return currentMarketPrice;
    }
    if (currentMarketPriceHistory.length > 0) {
      return currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price;
    }
    // ESTA LÍNEA ES CRÍTICA: Asegúrate de que retorna `null`, no `undefined`.
    return null;
  }, [selectedMarket.id, currentMarketPrice, currentMarketPriceHistory]);
 

  






  const toggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const toggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);


  
  useEffect(() => {
      console.log("[page] Sincronizando historial del gráfico con datos de Binance...");
      // currentMarketHistory ya contiene el historial de klines directamente de Binance
      // y useBinanceMarketData se encarga de mantenerlo actualizado.
      // Simplemente lo asignamos a nuestro estado local para el gráfico.
      if (currentMarketHistory && currentMarketHistory.length > 0) {
        setCurrentMarketPriceHistory(currentMarketHistory);
        console.log(`[page] Historial del gráfico actualizado con ${currentMarketHistory.length} puntos de Binance.`);
      } else if (!isMarketDataLoading && !marketDataError) {
        console.log("[page] No hay historial de mercado disponible aún desde Binance o está vacío.");
        setCurrentMarketPriceHistory([]); // Asegurarse de que esté vacío si no hay datos.
      }
    }, [currentMarketHistory, isMarketDataLoading, marketDataError]);


  useEffect(() => {
    if (selectedMarket.id === "BTCUSDT") {
      if (marketPriceUpdateIntervalRef.current) {
        // CAMBIO AQUÍ: Usar window.clearInterval
        window.clearInterval(marketPriceUpdateIntervalRef.current);
        marketPriceUpdateIntervalRef.current = null;
        console.log(`[Effect 3] Cleared price simulation interval because market is now BTCUSDT.`);
      }
      return;
    }

    if (marketPriceUpdateIntervalRef.current) {
      // CAMBIO AQUÍ: Usar window.clearInterval
      window.clearInterval(marketPriceUpdateIntervalRef.current);
    }

    console.log(`[Effect 3] Starting price simulation interval for ${selectedMarket.name}.`);
    // CAMBIO AQUÍ: Usar window.setInterval
    marketPriceUpdateIntervalRef.current = window.setInterval(() => {
      setCurrentMarketPriceHistory(prevHistory => {
        if (prevHistory.length === 0) {
          console.warn(`[Effect 3] Price simulation: prevHistory is empty for ${selectedMarket.name}. Cannot simulate.`);
          return prevHistory;
        }
        const lastPricePoint = prevHistory[prevHistory.length - 1];
        const basePrice = lastPricePoint.price;
        let fluctuationFactor = 0.0001;
        if (selectedMarket.baseAsset === 'ETH') fluctuationFactor = 0.0005;
        else if (selectedMarket.baseAsset !== 'BTC' && selectedMarket.baseAsset !== 'ETH') fluctuationFactor = 0.001;

        const randomFluctuation = (Math.random() - 0.5) * basePrice * fluctuationFactor * (Math.random() > 0.9 ? 10 : 1);
        const newPrice = Math.max(0.00001, basePrice + randomFluctuation);

        const newPoint = { timestamp: Math.floor(Date.now() / 1000), price: newPrice, volume: 0 };
        return [...prevHistory, newPoint].slice(-PRICE_HISTORY_POINTS_TO_KEEP);
      });
    }, Math.random() * 1500 + 1500);

    return () => {
      if (marketPriceUpdateIntervalRef.current) {
        // CAMBIO AQUÍ: Usar window.clearInterval
        window.clearInterval(marketPriceUpdateIntervalRef.current);
        marketPriceUpdateIntervalRef.current = null;
        console.log(`[Effect 3] Cleaned up price simulation interval for ${selectedMarket.name}.`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket.id, selectedMarket.baseAsset, selectedMarket.name]);











  // ... (código anterior) ...

  // src/app/page.tsx
  //... (código anterior) ...

  const runAutoSignalGeneration = useCallback(async () => {
    //... (código existente) ...
    if (isLoadingBotSignals) {
        console.log("[runAutoSignalGeneration] Solicitud de señales de IA ya en curso. Saltando este ciclo.");
        return;
    }

    console.log("Ciclo automático del bot: Iniciando análisis de estrategia para", selectedMarket.baseAsset);
    toast({
      title: "Análisis Automático del Bot",
      description: `El bot está analizando ${selectedMarket.name} con la estrategia...`,
      variant: "default",
      duration: 3000,
    });

    //CAMBIO CRÍTICO AQUÍ: Convertir el array a un string JSON
    const botStrategyInput: GenerateTradingSignalsInput = {
      historicalData: JSON.stringify(currentMarketPriceHistory), //CAMBIO CLAVE AQUÍ!
      strategy: "movingAverage",
      riskLevel: "medium",
      cryptocurrencyForAI: selectedMarket.baseAsset,
    };

    await generateSignalsActionWrapper(botStrategyInput, true);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedMarket.id,
    selectedMarket.name,
    selectedMarket.baseAsset,
    currentMarketPriceHistory, //Debe seguir aquí como dependencia!
    isLoadingBotSignals, // Añadido para evitar llamadas concurrentes
    generateSignalsActionWrapper, // generateSignalsActionWrapper ya está memoizada y maneja setIsLoadingBotSignals
    toast
  ]);
  




  

  useEffect(() => {
    if (isBotRunning) {
      console.log("Bot iniciado, configurando intervalo para", selectedMarket.name);
      if (botIntervalRef.current) {
        // CAMBIO AQUÍ: Usar window.clearInterval
        window.clearInterval(botIntervalRef.current);
      }
      runAutoSignalGeneration();
      // CAMBIO AQUÍ: Usar window.setInterval
      botIntervalRef.current = window.setInterval(runAutoSignalGeneration, BOT_AUTO_SIGNAL_INTERVAL_MS);
    } else {
      if (botIntervalRef.current) {
        console.log("Ciclo automático del bot: Detenido. Limpiando intervalo.");
        // CAMBIO AQUÍ: Usar window.clearInterval
        window.clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    }


    return () => {
      if (botIntervalRef.current) {
        console.log("Limpiando intervalo del bot (desmontaje o cambio de dependencias).");
        // CAMBIO AQUÍ: Usar window.clearInterval
        window.clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBotRunning, selectedMarket.id, selectedMarket.name, runAutoSignalGeneration]); // runAutoSignalGeneration ahora tiene sus propias dependencias correctas

// ... (resto de tu código) ...
  // src/app/page.tsx

  // src/app/page.tsx
  // ... (asegúrate de que los estados y funciones de los que depende handleMarketChange estén definidos antes)

  // ...

  const handleMarketChange = useCallback((marketId: string) => {
    const newMarket = availableMarkets.find((m: Market) => m.id === marketId);
    if (newMarket) {
      setSelectedMarket(newMarket);
      clearSignalData(); // Asegúrate de que clearSignalData está definida y limpia estados relacionados con señales anteriores.
      // ELIMINAMOS LA LÍNEA DE SIMULACIÓN DE BALANCE BASE:
      // const newBaseBalance = Math.random() * (newMarket.baseAsset === 'BTC' ? 0.2 : 5) + (newMarket.baseAsset === 'BTC' ? 0.01 : 0.5);
      // setCurrentBaseAssetBalance(newBaseBalance); // YA NO ES NECESARIO AQUÍ.
      // El balance real del asset base se actualizará a través de fetchBinanceBalances.
    }
  }, [availableMarkets, setSelectedMarket, clearSignalData /*, setCurrentBaseAssetBalance -- YA NO ES UNA DEPENDENCIA SI SE ELIMINA*/ ]);




  // ...
























  const totalPortfolioValue = useMemo(() => {
    if (availableQuoteBalance === null || latestPriceForPnl === null || currentBaseAssetBalance === undefined) {
      return null;
    }
    return availableQuoteBalance + (currentBaseAssetBalance * latestPriceForPnl);
  }, [availableQuoteBalance, currentBaseAssetBalance, latestPriceForPnl]);

  let centralColSpan = 'md:col-span-12';
  if (isLeftSidebarOpen && isRightSidebarOpen) {
    centralColSpan = 'md:col-span-6';
  } else if (isLeftSidebarOpen || isRightSidebarOpen) {
    centralColSpan = 'md:col-span-9';
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      
      <AppHeader
        toggleLeftSidebar={toggleLeftSidebar}
        isLeftSidebarOpen={isLeftSidebarOpen}
        toggleRightSidebar={toggleRightSidebar}
        isRightSidebarOpen={isRightSidebarOpen}
        portfolioBalance={availableQuoteBalance} // Asumo que quieres mostrar el balance de USDT aquí
        isBotRunning={isBotRunning} // <--- ¡Añade esto!
        toggleBotStatus={toggleBotStatus} // <--- ¡Añade esto!
      
      />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem-2rem)]">
          <aside className={`col-span-12 ${isLeftSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
            <ScrollArea className="flex-1 pr-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><PackageSearch className="w-4 h-4 mr-2" />Libro de Órdenes</CardTitle>
                  <CardDescription className="text-xs">Visualización del Libro de Órdenes (Funcionalidad Próximamente). Muestra la profundidad del mercado.</CardDescription> {/* CAMBIO DE TEXTO */}
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Libro de Órdenes - Próximamente) {/* CAMBIO DE TEXTO */}
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><LineChart className="w-4 h-4 mr-2" />Trades del Mercado</CardTitle>
                  <CardDescription className="text-xs">Últimas transacciones realizadas en el mercado (Funcionalidad Próximamente).</CardDescription> {/* CAMBIO DE TEXTO */}
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Trades del Mercado - Próximamente) {/* CAMBIO DE TEXTO */}
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <TradeHistoryTable trades={tradeHistory} />
            </ScrollArea>
          </aside>

          <section className={`col-span-12 ${centralColSpan} p-1 md:p-2 flex flex-col gap-2 transition-all duration-300 ease-in-out`}>
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket.id}
                marketId={selectedMarket.id}
                marketName={selectedMarket.name}
                //priceHistory={currentMarketPriceHistory} // <--- Asegúrate que priceHistory se alimenta del estado real
                smaCrossoverEvents={smaCrossoverEvents}
                aiSignalEvents={botSignalEvents} // <--- Asumo que has renombrado aiSignalEvents
                isBotActive={isBotRunning}
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <Card className="col-span-1 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Órdenes de Mercado (Binance)</CardTitle>
                  <CardDescription>Realiza órdenes de compra/venta directamente en Binance.</CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-6.5rem)] flex items-center justify-center">
                  <TradeForm
                    market={selectedMarket}
                    currentPrice={latestPriceForPnl ?? null}
                    availableQuoteBalance={parseFloat(allBinanceBalances?.[selectedMarket.quoteAsset]?.available?.toString() || '0')}
                    availableBaseBalance={parseFloat(allBinanceBalances?.[selectedMarket.baseAsset]?.available?.toString() || '0')}
                    // Asegúrate de que handlePlaceOrder se pasa correctamente como prop si TradeForm la necesita
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <aside className={`col-span-12 ${isRightSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-2 flex flex-col gap-2 border-l border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
            <ScrollArea className="flex-1 pr-2">
              <MarketSelector
                markets={availableMarkets}
                selectedMarketId={selectedMarket.id}
                onMarketChange={handleMarketChange}
              />
              <Separator className="my-4" />
              <Tabs defaultValue="bot-controls" className="w-full"> {/* CAMBIO DE defaultValue */}
                <TabsList className="grid w-full grid-cols-3 mb-2">
                  <TabsTrigger value="bot-controls"><BotIcon className="w-4 h-4 mr-1" />Control Bot</TabsTrigger> {/* CAMBIO DE TEXTO Y value */}
                  <TabsTrigger value="balance"><Wallet className="w-4 h-4 mr-1" />Info. Portafolio</TabsTrigger>
                  <TabsTrigger value="metric-guide"><BookOpen className="w-4 h-4 mr-1" />Guía</TabsTrigger>
                </TabsList>
                <TabsContent value="bot-controls"> {/* CAMBIO DE value */}
                  <BotControls
                    onSignalsGenerated={(data) => handleSignalsGenerated(data, false)}
                    onGenerationError={(errorMsg) => handleGenerationError(errorMsg, false)}
                    clearSignalData={clearSignalData}
                    generateSignalsAction={generateSignalsActionWrapper}
                    selectedMarketSymbol={selectedMarket.baseAsset}
                  />
                  <Separator className="my-4" />
                  <SignalDisplay
                    signalData={botSignalData} // <--- Asumo que has renombrado aiSignalData
                    isLoading={isLoadingBotSignals} // <--- Asumo que has renombrado isLoadingAiSignals
                    error={botError} // <--- Asumo que has renombrado aiError
                  />
                </TabsContent>
                <TabsContent value="balance">
                  <BalanceCard
                    title="Balance de USDT (Binance)"
                    description="Tu saldo disponible en USDT en Binance."
                    balance={binanceUSDTBalance}
                    asset="USDT"
                    isLoading={isBinanceBalancesLoading}
                  />
                  <PerformanceChart portfolioValue={totalPortfolioValue} />
                  <BinanceBalancesDisplay />
                  {selectedMarket && (
                    <Card className="mt-4">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm flex items-center"><Activity className="w-4 h-4 mr-2 text-primary" />{selectedMarket.name}</CardTitle>
                        <CardDescription className="text-xs">Información del Activo</CardDescription> {/* CAMBIO DE TEXTO */}
                      </CardHeader>
                      <CardContent className="text-xs space-y-1 pb-3">
                        {/* Asegúrate que currentBaseAssetBalance se actualice con los balances reales de Binance */}
                        <p>Balance {selectedMarket.baseAsset}: <span className="font-semibold">{currentBaseAssetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span></p>
                        <p>Precio Actual: <span className="font-semibold text-primary">${(latestPriceForPnl)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5 }) || 'N/A'}</span></p>
                        <p>Cambio 24h: <span className={(selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                        {/* ELIMINAR O REEMPLAZAR ESTA LÍNEA CON DATOS REALES DE VOLUMEN */}
                        <p>Volumen 24h: N/A (datos reales próximamente)</p> {/* CAMBIO DE TEXTO */}
                      </CardContent>
                    </Card>
                  )}
                  <SimulatedPnLDisplay position={currentSimulatedPosition} currentPrice={latestPriceForPnl} market={selectedMarket} />
                </TabsContent>
                <TabsContent value="metric-guide">
                  <Card>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-base flex items-center"><BookOpen className="w-4 h-4 mr-2 text-primary" />Guía de Métricas del Gráfico</CardTitle>
                      <CardDescription className="text-xs">Explicación de los indicadores visualizados.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <Accordion type="single" collapsible className="w-full">
                        {/* ... (AccordionItems de Precio, SMA10, SMA20, SMA50, SMA General - Mantener) ... */}
                        <AccordionItem value="bot-signals"> {/* CAMBIO DE value */}
                          <AccordionTrigger>Señales del Bot (Puntos Verde/Rojo Sólido)</AccordionTrigger> {/* CAMBIO DE TEXTO */}
                          <AccordionContent>
                            <p className="mb-2">Los puntos **verdes sólidos** (COMPRA) y **rojos sólidos** (VENTA) en el gráfico representan las señales generadas por el **análisis de tu estrategia de bot** que han superado el umbral de confianza configurado (actualmente {AI_TRADE_CONFIDENCE_THRESHOLD * 100}%) y que, por lo tanto, **han desencadenado una operación REAL por el bot** (si el bot está "iniciado" y en ciclo automático).</p>
                            <p className="mb-2">**Cómo se generan:** Cuando solicitas un análisis ("Generar Señales con el Bot") o cuando el bot lo hace en su ciclo automático, el sistema envía los datos históricos (reales de Binance), la estrategia seleccionada y el nivel de riesgo a tu lógica de estrategia. La estrategia procesa esta información y devuelve recomendaciones.</p>
                            <p className="mb-2">**Interpretación:**</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Un **punto verde sólido** aparece en el precio y momento en que la estrategia del bot identificó una oportunidad de COMPRA con suficiente confianza. Esto resulta en una orden de compra real (afectando tu saldo y P&L).</li>
                              <li>Un **punto rojo sólido** aparece de manera similar para una señal de VENTA.</li>
                              <li>El tooltip sobre estos puntos te dará el tipo de señal, el precio, la confianza y la hora.</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma-crossover-signals">
                          <AccordionTrigger>Señales de Cruce SMA (Puntos Verde/Rojo Claro)</AccordionTrigger>
                          <AccordionContent>
                            {/* ... (Contenido original, excepto la última frase que ya no es AI) ... */}
                            <p className="mt-2">Estas señales son puramente técnicas, basadas en el comportamiento de las medias móviles. No son generadas por la estrategia del bot directamente, sino calculadas por la lógica del gráfico. Pueden o no coincidir con las señales de la estrategia del bot. El bot actual **sí** opera automáticamente basado en estas señales si tu estrategia así lo define.</p> {/* CAMBIO DE TEXTO */}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </aside>
        </div>
      </main>
      <footer className="py-2 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} CryptoPilot. Operaciones y balances reales. {/* CAMBIO DE TEXTO */}
      </footer>
    </div>
  );
}
