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
import { Switch } from "@/components/ui/switch"; // *** NUEVA IMPORTACIÓN ***
import { Label } from "@/components/ui/label"; // *** NUEVA IMPORTACIÓN ***


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, PackageSearch, Info, TrendingUp, TrendingDown, WalletCards, BotIcon, BookOpen, Activity, Wallet, DollarSign, TestTube2 } from "lucide-react"; // *** TestTube2 Añadido ***

//                                                                                                                              ^^^^^^^^^ -- Añade DollarSign aquí

// Hooks y acciones
import { useToast } from "@/hooks/use-toast";
// Hooks de Binance (estos ahora necesitarán la prop useTestnet)
import { useBinanceMarketData } from "@/hooks/useBinanceMarketData";
import useBinanceBalances from "@/hooks/useBinanceBalances";
import useBinanceTradeHistory from "@/hooks/useBinanceTradeHistory";
import type { GenerateTradingSignalsInput } from "@/ai/flows/generate-trading-signals";

// Componentes de visualización de Binance (si los usas)
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display'; // <-- Ya estaba importado


// NUEVA IMPORTACIÓN DEL HOOK DEL BOT
import { useTradingBot } from '@/hooks/useTradingBot';

// --- Definir las interfaces necesarias aquí mismo para mayor claridad ---
// Esta interfaz Balance ya está definida en los endpoints y hooks, pero la mantendremos aquí
// si se usa directamente en este componente. Si no, considera eliminarla de aquí.
interface Balance {
  available: number; 
  onOrder: number;   
  total: number;     
}

interface BalancesResponse {
  message: string;
  balances: Record<string, { available: number; onOrder: number; total: number }>;
}
// --- Fin de interfaces ---

const MAX_AI_SIGNAL_EVENTS_ON_CHART = 5;
const AI_TRADE_CONFIDENCE_THRESHOLD = 0.01; // Umbral para que la IA actúe
const BOT_AUTO_SIGNAL_INTERVAL_MS = 30000; // IA genera señales cada 30s si el bot está ON


// Helper para validar señales de IA
const isValidSignalItem = (item: any): item is SignalItem => {
  return typeof item === 'object' && item !== null &&
    typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
    typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
};

// Componente para mostrar P&L simulado (sin cambios relevantes a la lógica de Testnet)
function SimulatedPnLDisplay({ position, currentPrice, market }: { position: SimulatedPosition | null; currentPrice: number | null; market: Market | null }) {
  if (!position || currentPrice === null || !market) {
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
  // *** NUEVO ESTADO PARA CONTROLAR TESTNET ***
  const [useTestnet, setUseTestnet] = useState(false); // Por defecto, opera en Mainnet

  const [selectedMarket, setSelectedMarket] = useState<Market>({
    id: "BTCUSDT", // Símbolo de CCXT, ej. BTC/USDT
    symbol: "BTCUSDT", // Símbolo de Binance, ej. BTCUSDT
    name: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    latestPrice: null,
    change24h: null,
    pricePrecision: 2, // Default, se actualizará desde el hook
    amountPrecision: 6, // Default
  });

  const [botSignalData, setBotSignalData] = useState<AISignalData | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [isLoadingAiSignals, setIsLoadingAiSignals] = useState(false);
  const [botSignalEvents, setBotSignalEvents] = useState<SignalEvent[]>([]);

  // Estados para historial de trades manuales/simulados y P&L simulado
  const [manualTradeHistory, setManualTradeHistory] = useState<Trade[]>([]); // Para simulación
  const [currentSimulatedPosition, setCurrentSimulatedPosition] = useState<SimulatedPosition | null>(null);

  // Estados para gestión de UI (sidebars)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  // Referencias para intervalos (usar NodeJS.Timeout para consistencia)
  const botAutoSignalIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const marketPriceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // --- Uso de Hooks de Binance, AHORA CON LA PROP useTestnet ---
  const {
    marketPrice: currentMarketPrice, // Precio actual del símbolo seleccionado
    marketHistory: currentMarketKlines, // Historial de klines del símbolo seleccionado
    availableMarkets, // Lista de todos los mercados disponibles
    isLoading: isMarketDataLoading,
    error: marketDataError,
    fetchMarketData: refreshMarketData, // Función para refrescar datos del mercado actual
  } = useBinanceMarketData({
    symbol: selectedMarket.id,
    timeframe: "1m",
    limit: PRICE_HISTORY_POINTS_TO_KEEP,
    useTestnet: useTestnet, // *** Pasar el estado useTestnet ***
    initialFetch: true,
  });

  const {
    balances: allBinanceBalances, // Todos los balances de la cuenta de Binance
    isLoadingBalances: isBinanceBalancesLoading,
    balancesError,
    fetchBalances: refreshBinanceBalances, // Función para refrescar balances
  } = useBinanceBalances({
    initialFetch: true,
    fetchIntervalMs: 60000, // Refrescar balances cada 60 segundos
    useTestnet: useTestnet, // *** Pasar el estado useTestnet ***
  });

  const {
    tradeHistory: binanceTradeHistory, // Historial de trades REALES de Binance
    isLoadingTradeHistory: isBinanceTradeHistoryLoading,
    tradeHistoryError,
    fetchTradeHistory: refreshBinanceTradeHistory, // Función para refrescar historial de trades
  } = useBinanceTradeHistory({
    initialFetch: true,
    symbol: selectedMarket.symbol, // Solo para el mercado seleccionado por ahora
    useTestnet: useTestnet, // *** Pasar el estado useTestnet ***
    limit: 50, // Obtener los últimos 50 trades
  });
  
  // Estado para el historial de precios que se muestra en el gráfico (puede ser de Binance o simulado)
  const [chartPriceHistory, setChartPriceHistory] = useState<MarketPriceDataPoint[]>([]);


  // --- Hook del Bot de Trading ---
  const {
    isBotRunning,
    toggleBotStatus, // Función para iniciar/detener el bot
    botOpenPosition, // Posición actual simulada del bot
    // botLastActionTimestamp, // No se usa directamente en la UI ahora
    isPlacingOrder: isBotPlacingOrder,
    placeOrderError: botPlaceOrderError,
  } = useTradingBot({
    selectedMarket,
    currentMarketPriceHistory: chartPriceHistory, // El bot usa el historial del gráfico
    currentPrice: currentMarketPrice,
    allBinanceBalances,
    botIntervalMs: 15000, // Bot evalúa estrategia cada 15s
    useTestnet: useTestnet, // *** Pasar el estado useTestnet al bot ***
    onBotAction: (result) => { // Callback cuando el bot intenta una acción
        if (result.type === 'orderPlaced') {
            console.log('[Page] Bot action result:', result);
            if (result.success) {
                // Si la orden del bot fue exitosa, refrescamos balances e historial
                refreshBinanceBalances();
                refreshBinanceTradeHistory({ symbol: selectedMarket.symbol }); // Refrescar para el símbolo actual
            }
            // Toasts de éxito/error ya se manejan dentro de useTradingBot
        }
    }
  });

  // Efecto para actualizar el historial del gráfico (chartPriceHistory)
  // cuando cambian los klines del mercado actual (currentMarketKlines de useBinanceMarketData)
  useEffect(() => {
    if (currentMarketKlines && currentMarketKlines.length > 0) {
      console.log(`[Page] Actualizando chartPriceHistory con ${currentMarketKlines.length} klines de useBinanceMarketData para ${selectedMarket.symbol}`);
      setChartPriceHistory(currentMarketKlines);
    } else if (!isMarketDataLoading && selectedMarket.symbol) {
      // Si no está cargando y hay un símbolo, pero no hay klines, podría ser un error o que el símbolo no tiene historial
      console.warn(`[Page] No se recibieron klines para ${selectedMarket.symbol} o el historial está vacío.`);
      // Podrías querer limpiar el historial o manejar este caso específicamente
      // setChartPriceHistory([]); // Descomenta si quieres limpiar el gráfico en este caso
    }
  }, [currentMarketKlines, isMarketDataLoading, selectedMarket.symbol]);


  // Lógica para el precio del P&L simulado
  const latestPriceForPnl = useMemo(() => {
    if (currentMarketPrice !== null && currentMarketPrice > 0) {
      return currentMarketPrice;
    }
    if (chartPriceHistory.length > 0) {
      return chartPriceHistory[chartPriceHistory.length - 1].price;
    }
    return null;
  }, [currentMarketPrice, chartPriceHistory]);

  // Lógica para el valor total del portafolio (basado en balances de Binance)
  const totalPortfolioValueUSD = useMemo(() => {
    if (!allBinanceBalances || Object.keys(allBinanceBalances).length === 0 || !availableMarkets.length) {
      return null;
    }
    // Este cálculo es una simplificación. Un cálculo real necesitaría precios actuales para TODOS los activos.
    // Por ahora, solo sumaremos el valor de USDT directamente y el valor de BTC (si existe) usando su precio actual.
    let totalValue = 0;
    const usdtBalance = allBinanceBalances['USDT']?.available || 0;
    totalValue += usdtBalance;

    const btcBalance = allBinanceBalances['BTC']?.available || 0;
    if (btcBalance > 0) {
        // Necesitaríamos el precio actual de BTC/USDT para esto.
        // Asumimos que currentMarketPrice es para el selectedMarket.
        // Si selectedMarket es BTCUSDT, podemos usarlo. Sino, este cálculo será impreciso.
        if (selectedMarket.id === 'BTCUSDT' && currentMarketPrice) {
            totalValue += btcBalance * currentMarketPrice;
        } else {
            // Podríamos intentar buscar el precio de BTCUSDT en availableMarkets si tienen latestPrice,
            // pero por ahora, esto es una simplificación.
            console.warn("Calculando valor del portafolio: precio de BTC no disponible directamente para convertir balance de BTC a USD.");
        }
    }
    return totalValue;
  }, [allBinanceBalances, availableMarkets, selectedMarket, currentMarketPrice]);


  // --- MANEJO DE LA INTERFAZ DE USUARIO (SIDEBARS) ---
  const toggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const toggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);

  // --- CAMBIO DE MERCADO ---
  const handleMarketChange = useCallback((marketId: string) => {
    const newMarket = availableMarkets.find((m: Market) => m.id === marketId);
    if (newMarket) {
      console.log(`[Page] Cambiando a mercado: ${newMarket.name}`);
      setSelectedMarket(newMarket);
      setBotSignalData(null); // Limpiar señales de IA del mercado anterior
      setBotSignalEvents([]); // Limpiar eventos de señal en el gráfico
      // No es necesario resetear currentSimulatedPosition o manualTradeHistory aquí
      // a menos que quieras que sean específicos por mercado.
    }
  }, [availableMarkets]);


  // --- GENERACIÓN DE SEÑALES DE IA (Manual) ---
  const handleGenerateSignalsAction = useCallback(async (
    strategy: GenerateTradingSignalsInput['strategy'],
    riskLevel: GenerateTradingSignalsInput['riskLevel']
  ) => {
    if (!selectedMarket || chartPriceHistory.length < 10) {
      toast({ title: "Datos Insuficientes", description: "Se necesita más historial de precios para generar señales.", variant: "destructive" });
      return;
    }
    if (isLoadingAiSignals) {
      toast({ title: "Procesando", description: "Ya se están generando señales.", variant: "default" });
      return;
    }

    setIsLoadingAiSignals(true);
    setBotError(null);
    console.log(`[Page] Solicitando señales de IA para ${selectedMarket.name}, Estrategia: ${strategy}, Riesgo: ${riskLevel}`);

    try {
      // Importar la función de Genkit DINÁMICAMENTE solo cuando se necesita
      const { generateTradingSignals } = await import('@/ai/flows/generate-trading-signals');
      
      const historicalDataForAI = JSON.stringify(
        chartPriceHistory.slice(-50).map(p => ({ // Usar últimos 50 puntos para la IA
          timestamp: new Date(p.timestamp * 1000).toISOString(),
          open: p.price, // Simplificación: usamos precio como open/high/low/close
          high: p.price,
          low: p.price,
          close: p.price,
          volume: p.volume,
        }))
      );

      const input: GenerateTradingSignalsInput = {
        historicalData: historicalDataForAI,
        strategy,
        riskLevel,
        cryptocurrencyForAI: selectedMarket.baseAsset,
      };

      const result = await generateTradingSignals(input);
      console.log("[Page] Señales de IA recibidas:", result);

      // Procesar las señales para la UI y potencialmente para el bot (si está en modo manual y se quiere actuar)
      setBotSignalData(result);
      if (result.signals) {
        try {
          const parsed = JSON.parse(result.signals) as ParsedSignals;
          if (Array.isArray(parsed) && (parsed.length === 0 || parsed.every(isValidSignalItem))) {
            const newEvents: SignalEvent[] = parsed
              .filter(s => s.signal === 'BUY' || s.signal === 'SELL')
              .map(s => ({
                timestamp: Math.floor(Date.now() / 1000), // Marcar en el momento de la generación
                price: currentMarketPrice || chartPriceHistory[chartPriceHistory.length - 1]?.price || 0,
                type: s.signal as 'BUY' | 'SELL',
                confidence: s.confidence,
              }));
            setBotSignalEvents(prev => [...prev, ...newEvents].slice(-MAX_AI_SIGNAL_EVENTS_ON_CHART));
            toast({ title: "Análisis de IA Completo", description: `Señales generadas para ${selectedMarket.name}.`, variant: "default" });
          } else {
            throw new Error("Formato de señales de IA inválido.");
          }
        } catch (parseError) {
          console.error("Error al parsear señales de IA:", parseError, "Datos:", result.signals);
          setBotError("Error al interpretar las señales de la IA.");
          toast({ title: "Error de Señal IA", description: "No se pudieron interpretar las señales.", variant: "destructive" });
        }
      }

    } catch (error: any) {
      console.error("Error al generar señales de IA:", error);
      const message = error.message || "Error desconocido al generar señales de IA.";
      setBotError(message);
      toast({ title: "Error de IA", description: message, variant: "destructive" });
    } finally {
      setIsLoadingAiSignals(false);
    }
  }, [selectedMarket, chartPriceHistory, isLoadingAiSignals, toast, currentMarketPrice]);


  // --- COLOCAR ÓRDENES (Manuales desde TradeForm) ---
  const handlePlaceManualOrder = useCallback(async (orderData: OrderFormData): Promise<boolean> => {
    console.log(`[Page] Recibida orden manual:`, orderData, `Modo Testnet: ${useTestnet}`);
    // Esta función será llamada por TradeForm. Debe interactuar con los endpoints de API reales.
    
    // Determinar el endpoint correcto (mainnet o testnet)
    const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';
    console.log(`[Page] Intentando colocar orden manual en endpoint: ${endpoint}`);

    // Aquí no hay estado de carga específico para orden manual, TradeForm podría manejarlo
    // o podríamos añadir uno si fuera necesario.
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // El objeto orderData ya debería tener: symbol, type (market/limit), side (buy/sell), amount, price (opcional)
        // Asegurémonos que el símbolo que se envía es el esperado por el backend (ej. BTCUSDT, no BTC/USDT)
        body: JSON.stringify({
            symbol: orderData.marketId, // TradeForm usa market.symbol que es ej. BTCUSDT
            type: orderData.orderType,
            side: orderData.type,
            amount: orderData.amount,
            price: orderData.price, // Solo para órdenes límite
            // El endpoint de backend ya usa isTestnet en su propia lógica o se pasa en la URL
        }),
      });

      const result = await response.json(); // { success: boolean, message: string, orderId?: string, ... }

      if (response.ok && result.success) {
        toast({
          title: `Orden ${orderData.type === 'buy' ? 'Compra' : 'Venta'} Manual Exitosa`,
          description: `Orden ${result.orderId || ''} para ${orderData.amount} ${selectedMarket.baseAsset} en ${orderData.marketId} (${useTestnet ? 'Testnet' : 'Mainnet'}). Estado: ${result.status || 'Enviada'}.`,
          variant: "default",
        });
        // Refrescar balances e historial después de una orden exitosa
        refreshBinanceBalances();
        refreshBinanceTradeHistory({ symbol: orderData.marketId });
        return true;
      } else {
        toast({
          title: `Error en Orden Manual`,
          description: result.message || `No se pudo colocar la orden en ${orderData.marketId} (${useTestnet ? 'Testnet' : 'Mainnet'}).`,
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      console.error("[Page] Error al colocar orden manual:", error);
      toast({
        title: "Error de Conexión",
        description: `No se pudo completar la orden manual: ${error.message || 'Error desconocido.'}`,
        variant: "destructive",
      });
      return false;
    }
  }, [useTestnet, toast, selectedMarket, refreshBinanceBalances, refreshBinanceTradeHistory]);


  // Configuración de columnas para la UI
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
        portfolioBalance={totalPortfolioValueUSD} // Usar el valor calculado para USD
        isBotRunning={isBotRunning}
        toggleBotStatus={toggleBotStatus}
      />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem-2rem)]"> {/* Ajustar altura si footer es más grande */}
          <aside className={`col-span-12 ${isLeftSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
            <ScrollArea className="flex-1 pr-2">
              {/* ... Contenido de la barra lateral izquierda (Libro de Órdenes, Trades del Mercado) ... */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><PackageSearch className="w-4 h-4 mr-2" />Libro de Órdenes</CardTitle>
                  <CardDescription className="text-xs">Visualización del Libro de Órdenes (Funcionalidad Próximamente).</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Libro de Órdenes - Próximamente)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><LineChart className="w-4 h-4 mr-2" />Trades del Mercado</CardTitle>
                  <CardDescription className="text-xs">Últimas transacciones realizadas en el mercado (Funcionalidad Próximamente).</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Trades del Mercado - Próximamente)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              {/* Usar binanceTradeHistory para el historial real, manualTradeHistory para simulación (si se mantiene) */}
              <TradeHistoryTable trades={binanceTradeHistory || manualTradeHistory} />
            </ScrollArea>
          </aside>

          <section className={`col-span-12 ${centralColSpan} p-1 md:p-2 flex flex-col gap-2 transition-all duration-300 ease-in-out`}>
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket.id} // Para forzar re-renderizado completo al cambiar de mercado
                marketId={selectedMarket.id}
                marketName={selectedMarket.name}
                // priceHistory se maneja internamente por MarketPriceChart usando useBinanceMarketData
                aiSignalEvents={botSignalEvents} // Señales de IA para pintar en el gráfico
                smaCrossoverEvents={[]} // Lógica de cruces SMA está dentro de MarketPriceChart ahora
                isBotActive={isBotRunning}
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <Card className="col-span-1 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Órdenes de Mercado ({useTestnet ? 'Testnet' : 'Mainnet'})</CardTitle>
                  <CardDescription>Realiza órdenes de compra/venta en Binance.</CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-6.5rem)] flex items-center justify-center">
                  {selectedMarket && ( // Asegurarse que selectedMarket y allBinanceBalances no sean null
                    <TradeForm
                      market={selectedMarket}
                      currentPrice={currentMarketPrice}
                      availableQuoteBalance={parseFloat(allBinanceBalances?.[selectedMarket.quoteAsset]?.available?.toString() || '0')}
                      availableBaseBalance={parseFloat(allBinanceBalances?.[selectedMarket.baseAsset]?.available?.toString() || '0')}
                      onSubmit={handlePlaceManualOrder} // Pasar la función para órdenes manuales
                    />
                  )}
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
              
              {/* *** Interruptor para Testnet *** */}
              <Card className="mb-4">
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm flex items-center">
                        <TestTube2 className="w-4 h-4 mr-2 text-purple-500" />
                        Modo de Operación
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-2 pb-3">
                    <Switch
                        id="testnet-mode"
                        checked={useTestnet}
                        onCheckedChange={setUseTestnet}
                        aria-label="Activar modo Testnet"
                    />
                    <Label htmlFor="testnet-mode" className="text-sm">
                        Usar Binance Testnet ({useTestnet ? "Activado" : "Desactivado"})
                    </Label>
                </CardContent>
              </Card>
              
              <Tabs defaultValue="bot-ai-controls" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-2">
                  <TabsTrigger value="bot-ai-controls"><BotIcon className="w-4 h-4 mr-1" />Bot/IA</TabsTrigger>
                  <TabsTrigger value="balance"><Wallet className="w-4 h-4 mr-1" />Portafolio</TabsTrigger>
                  <TabsTrigger value="metric-guide"><BookOpen className="w-4 h-4 mr-1" />Guía</TabsTrigger>
                </TabsList>
                <TabsContent value="bot-ai-controls">
                  <BotControls
                    isBotRunning={isBotRunning}
                    onToggleBot={toggleBotStatus}
                    onGenerateSignals={handleGenerateSignalsAction} // Para el botón manual de señales IA
                    selectedMarketSymbol={selectedMarket.baseAsset}
                    isLoadingAiSignals={isLoadingAiSignals}
                    // clearSignalData no es necesario aquí si se limpia al cambiar de mercado
                  />
                  <Separator className="my-4" />
                  <SignalDisplay
                    signalData={botSignalData}
                    isLoading={isLoadingAiSignals}
                    error={botError}
                  />
                </TabsContent>
                <TabsContent value="balance">
                  <BalanceCard
                    title={`Balance Total (Estimado ${useTestnet ? 'Testnet' : 'Mainnet'})`}
                    description="Valor estimado de tu portafolio en USD."
                    balance={totalPortfolioValueUSD}
                    asset="USD"
                    isLoading={isBinanceBalancesLoading || isMarketDataLoading}
                  />
                  <PerformanceChart portfolioValue={totalPortfolioValueUSD} />
                  {/* BinanceBalancesDisplay ahora usará el hook useBinanceBalances, que respeta useTestnet */}
                  <BinanceBalancesDisplay useTestnet={useTestnet} /> 
                  
                  {selectedMarket && (
                    <Card className="mt-4">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm flex items-center"><Activity className="w-4 h-4 mr-2 text-primary" />{selectedMarket.name} ({useTestnet ? 'Testnet' : 'Mainnet'})</CardTitle>
                        <CardDescription className="text-xs">Información del Activo</CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1 pb-3">
                        <p>Balance {selectedMarket.baseAsset}: <span className="font-semibold">{(allBinanceBalances?.[selectedMarket.baseAsset]?.available || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span></p>
                        <p>Precio Actual: <span className="font-semibold text-primary">${(currentMarketPrice)?.toLocaleString('en-US', { minimumFractionDigits: selectedMarket.pricePrecision || 2, maximumFractionDigits: selectedMarket.pricePrecision || 5 }) || 'N/A'}</span></p>
                        <p>Cambio 24h: <span className={(selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                        <p>Volumen 24h (Base): N/A</p>
                      </CardContent>
                    </Card>
                  )}
                  {/* P&L Simulado (basado en botOpenPosition que es una simulación local del bot) */}
                  <SimulatedPnLDisplay position={botOpenPosition} currentPrice={latestPriceForPnl} market={selectedMarket} />
                </TabsContent>
                <TabsContent value="metric-guide">
                  {/* ... Contenido de la guía de métricas ... */}
                   <Card>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-base flex items-center"><BookOpen className="w-4 h-4 mr-2 text-primary" />Guía de Métricas del Gráfico</CardTitle>
                      <CardDescription className="text-xs">Explicación de los indicadores visualizados.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="price">
                          <AccordionTrigger>Precio (Línea Principal)</AccordionTrigger>
                          <AccordionContent>
                            La línea principal (generalmente azul o verde brillante) representa el precio de cierre del activo para cada intervalo de tiempo en el gráfico (ej. cada minuto).
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma">
                          <AccordionTrigger>Medias Móviles Simples (SMA)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Las SMAs suavizan los datos de precios para mostrar la tendencia general. Se calculan promediando el precio de cierre durante un período específico (ej. SMA10 usa los últimos 10 puntos).</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><strong>SMA10 (Amarillo):</strong> Media móvil corta, reacciona más rápido a los cambios de precio.</li>
                              <li><strong>SMA20 (Naranja):</strong> Media móvil media, usada a menudo para identificar tendencias a corto y medio plazo.</li>
                              <li><strong>SMA50 (Rojo):</strong> Media móvil larga, indica la tendencia a más largo plazo. El bot puede usar esta como referencia.</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="macd">
                          <AccordionTrigger>MACD (Moving Average Convergence Divergence)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">El MACD es un indicador de momento que sigue tendencias. Se compone de:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><strong>Línea MACD (Azul Oscuro):</strong> Diferencia entre dos EMAs (medias móviles exponenciales, generalmente 12 y 26 períodos).</li>
                              <li><strong>Línea de Señal (Naranja):</strong> Una EMA de la Línea MACD (generalmente 9 períodos).</li>
                              <li><strong>Histograma (Barras Verdes/Rojas):</strong> Diferencia entre la Línea MACD y la Línea de Señal. Barras verdes indican momento alcista, rojas indican momento bajista. Cruces del histograma por cero pueden ser señales.</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="bot-signals">
                          <AccordionTrigger>Señales del Bot IA (Puntos Verde/Rojo Sólido)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Los puntos **verdes sólidos** (COMPRA) y **rojos sólidos** (VENTA) en el gráfico representan las señales generadas por el **análisis de IA de Genkit** que han superado el umbral de confianza configurado (actualmente {AI_TRADE_CONFIDENCE_THRESHOLD * 100}%) y que podrían desencadenar una operación si el bot está activo.</p>
                            <p className="mb-2">**Cómo se generan:** Cuando solicitas un análisis ("Generar Señales con IA") o cuando el bot lo hace en su ciclo automático, el sistema envía los datos históricos, la estrategia seleccionada y el nivel de riesgo al modelo de IA de Google (Gemini). El modelo devuelve recomendaciones.</p>
                            <p className="mb-2">**Interpretación:**</p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li>Un **punto verde sólido** aparece en el precio y momento en que la IA identificó una oportunidad de COMPRA con suficiente confianza. Si el bot está activo, intentará realizar una compra.</li>
                              <li>Un **punto rojo sólido** aparece de manera similar para una señal de VENTA.</li>
                              <li>El tooltip sobre estos puntos te dará el tipo de señal, el precio, la confianza y la hora.</li>
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="sma-crossover-signals">
                          <AccordionTrigger>Señales de Cruce SMA (Puntos Verde/Rojo Claro)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Los puntos **verdes claros** (COMPRA) y **rojos claros** (VENTA) indican cruces de las medias móviles (SMA10 y SMA20) que pueden ser interpretados como señales técnicas:</p>
                             <ul className="list-disc pl-5 space-y-1">
                               <li>Un **punto verde claro** aparece cuando la SMA10 (más rápida) cruza POR ENCIMA de la SMA20 (más lenta), sugiriendo un posible inicio de tendencia alcista.</li>
                               <li>Un **punto rojo claro** aparece cuando la SMA10 cruza POR DEBAJO de la SMA20, sugiriendo un posible inicio de tendencia bajista.</li>
                             </ul>
                             <p className="mt-2">Estas señales son puramente técnicas, basadas en el comportamiento de las medias móviles. No son generadas por la IA de Genkit. El bot actual **sí** opera automáticamente basado en estas señales si tu estrategia así lo define.</p>
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
      <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} CryptoPilot. {useTestnet ? 'Operando en Binance Testnet.' : 'Operando en Binance Mainnet.'} Las operaciones son reales.
      </footer>
    </div>
  );
}
