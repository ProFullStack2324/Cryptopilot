// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Dispatch, SetStateAction } from "react";
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
  SmaCrossoverEvent,
  UseTradingBotProps,       // <--- Importa esta interfaz
  AppHeaderProps,           // <--- Importa esta interfaz
  MarketPriceChartProps,    // <--- Importa esta interfaz
  TradeFormProps,           // <--- Importa esta interfaz
  BalanceCardProps,         // <--- Importa esta interfaz
  BinanceBalancesDisplayProps, // <--- Importa esta interfaz
  Balance                   // <--- Importa esta interfaz si no la tienes definida localmente
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


// Componentes Shadcn UI
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// Iconos de Lucide React
import { LineChart, PackageSearch, Info, TrendingUp, TrendingDown, WalletCards, BotIcon, BookOpen, Activity, Wallet, DollarSign, TestTube2 } from "lucide-react";

//                                                                                                                              ^^^^^^^^^ -- Añade DollarSign aquí

// Hooks y acciones
import { useToast } from "@/hooks/use-toast";
import { useBinanceMarketData } from "@/hooks/useBinanceMarketData";
import type { GenerateTradingSignalsInput } from "@/ai/flows/generate-trading-signals";

// Componentes de visualización de Binance (si los usas)
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display'; // <-- Ya estaba importado


// NUEVA IMPORTACIÓN DEL HOOK DEL BOT
import { useTradingBot } from '@/hooks/useTradingBot';
import useBinanceBalances from "@/hooks/useBinanceBalances";
import useBinanceTradeHistory from "@/hooks/useBinanceTradeHistory";


interface BalancesResponse {
  success: boolean; // <-- AÑADIDO
  message: string;
  balances?: Record<string, { available: number; onOrder: number; total: number }>; // 'balances' es opcional porque no está en respuestas de error
  details?: string; // <-- AÑADIDO (es opcional)
  // Puedes añadir otras propiedades que el backend devuelva y te sean útiles, como:
  // binanceErrorCode?: number;
  // timestamp?: number;
  // datetime?: string;
}

interface OrderBook {
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  timestamp: number;
  datetime: string;
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
    id: "BTCUSDT", // Símbolo de Binance (ej. BTCUSDT)
    symbol: "BTC/USDT", // Símbolo CCXT (ej. BTC/USDT)
    name: "BTC/USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    latestPrice: null,
    change24h: null
  });

  // RENOMBRADO DE ESTADOS: Mantener el tipo original 'AISignalData' por ahora.
  const [botSignalData, setBotSignalData] = useState<AISignalData | null>(null); // ¡CAMBIO AQUÍ! Usa AISignalData
  const [botError, setBotError] = useState<string | null>(null);
  const [isLoadingBotSignals, setIsLoadingBotSignals] = useState(false);
  const [botSignalEvents, setBotSignalEvents] = useState<SignalEvent[]>([]); // ¡CAMBIO AQUÍ! Usa SignalEvent

  const [availableQuoteBalance, setAvailableQuoteBalance] = useState<number | null>(null);
  // const [currentBaseAssetBalance, setCurrentBaseAssetBalance] = useState<number>(0); // Eliminado, se usará allBinanceBalances
  // const [tradeHistory, setTradeHistory] = useState<Trade[]>([]); // Eliminado, se usará useBinanceTradeHistory

  const [smaCrossoverEvents, setSmaCrossoverEvents] = useState<SmaCrossoverEvent[]>([]); // <-- ¡AHORA ESTÁ AQUÍ!

  const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
  const [currentSimulatedPosition, setCurrentSimulatedPosition] = useState<SimulatedPosition | null>(null);

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true); // Sidebar derecha abierta por defecto

  // ESTADO CLAVE PARA EL BOT
  const [isBotRunningState, setIsBotRunningState] = useState<boolean>(false); 
  
  const botIntervalRef = useRef<number | null>(null);
  const marketPriceUpdateIntervalRef = useRef<number | null>(null);
  
  
  // ESTADO PARA CONTROLAR TESTNET/MAINNET (SE MANTIENE PORQUE OTROS COMPONENTES LO USAN)
  const [useTestnet, setUseTestnet] = useState<boolean>(false); // Por defecto Mainnet

  const [isLoadingTrade, setIsLoadingTrade] = useState(false); 

  // --- ESTADOS A AÑADIR PARA LIBRO DE ÓRDENES Y TRADES RECIENTES ---
  const [orderBookData, setOrderBookData] = useState<OrderBook | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]); // O `null` si prefieres manejar ese estado inicial
  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);
  const [isLoadingRecentTrades, setIsLoadingRecentTrades] = useState(false);
  const [orderBookError, setOrderBookError] = useState<string | null>(null);
  const [recentTradesError, setRecentTradesError] = useState<string | null>(null);
  // --- FIN DE ESTADOS AÑADIR ---



  // ======================================================================
  // 2. LLAMADAS A HOOKS DE UTILIDAD Y HOOKS PERSONALIZADOS
  // ======================================================================
  const { toast } = useToast();

  const {
    marketPrice: currentMarketPrice,
    marketHistory: currentMarketHistoryFromHook, // Renombrar para evitar colisión con estado local
    availableMarkets,
    isLoading: isMarketDataLoading,
    error: marketDataError
  } = useBinanceMarketData({
    symbol: selectedMarket?.id, // Usar selectedMarket.id que es el formato para Binance API
    timeframe: "1m",
    limit: PRICE_HISTORY_POINTS_TO_KEEP,
    useTestnet: useTestnet, // Pasar el estado de testnet
    initialFetch: true,
  });

  const {
    balances: allBinanceBalances, // Renombrar para claridad
    isLoadingBalances: isBinanceBalancesLoading,
    balancesError: binanceBalancesError,
    fetchBalances: fetchBinanceBalancesFromHook, // Renombrar
  } = useBinanceBalances({
    initialFetch: true,
    useTestnet: useTestnet, // Pasar el estado de testnet
    fetchIntervalMs: 30000, // Actualizar balances cada 30 segundos
  });

  const {
    tradeHistory,
    isLoadingTradeHistory,
    tradeHistoryError,
    fetchTradeHistory: fetchTradeHistoryFromHook, // Renombrar
  } = useBinanceTradeHistory({
    initialFetch: true,
    useTestnet: useTestnet, // Pasar el estado de testnet
    symbol: selectedMarket?.symbol, // Pasar el símbolo CCXT (ej. BTC/USDT)
    limit: 50, // Cargar los últimos 50 trades
  });


  // c) handlePlaceOrder (¡AJUSTE CLAVE AQUÍ: DEFINIR handlePlaceOrder ANTES DE useTradingBot!)
  const handlePlaceOrder = useCallback(async (orderData: OrderFormData): Promise<boolean> => {
    console.log(`[handlePlaceOrder] Intentando ejecutar orden REAL: ${orderData.type} ${orderData.amount} de ${orderData.marketId} (${useTestnet ? 'Testnet' : 'Mainnet'})`);
    setIsLoadingTrade(true);
    let success = false;

    try {
        const tradePayload = {
            symbol: orderData.marketId, // marketId es el símbolo de Binance (ej. BTCUSDT)
            type: orderData.orderType,
            side: orderData.type,
            amount: orderData.amount,
            price: orderData.price,
            isTestnet: useTestnet, // El endpoint deducirá esto o ya estará configurado
        };

        console.log("[handlePlaceOrder] Enviando payload al backend:", tradePayload);
        
        const endpoint = useTestnet ? '/api/binance/trade-testnet' : '/api/binance/trade';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tradePayload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            toast({
                title: `Orden de ${orderData.type === 'buy' ? 'Compra' : 'Venta'} Exitosa (${useTestnet ? 'Testnet' : 'Mainnet'})`,
                description: `Orden ${result.orderId || ''} para ${orderData.amount} ${selectedMarket?.baseAsset || ''} @ ${orderData.price || 'Mercado'} en ${orderData.marketId}. Estado: ${result.status}.`,
                variant: "default",
            });
            success = true;
            fetchBinanceBalancesFromHook(); // Refrescar balances reales
            fetchTradeHistoryFromHook({ symbol: selectedMarket?.symbol, limit: 50}); // Refrescar historial de trades
        } else {
            console.error("[handlePlaceOrder] Error del backend:", result.message, result.details);
            toast({
                title: `Error al Ejecutar Orden (${useTestnet ? 'Testnet' : 'Mainnet'})`,
                description: result.message || result.details || 'Error reportado por el backend.',
                variant: "destructive",
            });
        }
    } catch (error: any) {
        console.error("[handlePlaceOrder] Error en la llamada fetch:", error);
        toast({
            title: "Error de Conexión",
            description: `No se pudo completar la solicitud: ${error.message || 'Error desconocido.'}`,
            variant: "destructive",
        });
    } finally {
        setIsLoadingTrade(false);
    }
    return success;
  }, [
    selectedMarket,
    currentMarketPrice,
    toast,
    setIsLoadingTrade,
    useTestnet, // Añadir useTestnet a las dependencias
    fetchBinanceBalancesFromHook,
    fetchTradeHistoryFromHook,
  ]);

  const {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder: isBotPlacingOrder, // Renombrar para evitar conflicto
    placeOrderError: botPlaceOrderError,
    selectedMarketRules,
    marketRulesError,
  } = useTradingBot({
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice: currentMarketPrice,
    allBinanceBalances,
    botIntervalMs: BOT_AUTO_SIGNAL_INTERVAL_MS,
    isBotRunning: isBotRunningState,
    setIsBotRunning: setIsBotRunningState,
    useTestnet: useTestnet,
    onBotAction: (result) => {
      console.log("[Page - onBotAction] Acción del bot recibida:", result);
      if (result.type === 'orderPlaced' && result.success) {
        fetchBinanceBalancesFromHook(); // Refrescar balances después de una orden del bot
        fetchTradeHistoryFromHook({ symbol: selectedMarket?.symbol, limit: 50 }); // Refrescar historial
      }
    }
  });


  // ======================================================================
  // 3. DECLARACIONES DE FUNCIONES useCallback/useMemo
  // ======================================================================
  const clearSignalData = useCallback(() => {
    setBotSignalData(null);
    setBotError(null);
    setBotSignalEvents([]);
    setSmaCrossoverEvents([]);
  }, [setBotSignalData, setBotError, setBotSignalEvents, setSmaCrossoverEvents]);

  const handleGenerationError = useCallback((errorMsg: string, isAutoCall: boolean = false) => {
    setBotSignalData(null);
    setBotError(errorMsg);
    if (!isAutoCall) {
      toast({ title: "Error al Generar Señales del Bot", description: errorMsg, variant: "destructive" });
    } else {
      console.error("Error en ciclo automático del Bot:", errorMsg);
      toast({ title: "Error en Ciclo del Bot", description: `Fallo al analizar ${selectedMarket?.name}. Revise la consola.`, variant: "destructive", duration: 3000 });
    }
  }, [setBotSignalData, setBotError, selectedMarket?.name, toast]);

  const latestPriceForPnl = useMemo(() => {
    if (currentMarketPrice !== null) return currentMarketPrice;
    if (currentMarketPriceHistory.length > 0) {
      return currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price;
    }
    return null;
  }, [currentMarketPrice, currentMarketPriceHistory]);
 
  const toggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const toggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);

  const handleMarketChange = useCallback((marketIdBinance: string) => { // marketIdBinance es ej: BTCUSDT
    const newMarket = availableMarkets.find((m: Market) => m.id === marketIdBinance);
    if (newMarket) {
      console.log(`[handleMarketChange] Cambiando a mercado: ${newMarket.name} (ID Binance: ${newMarket.id}, Símbolo CCXT: ${newMarket.symbol})`);
      setSelectedMarket(newMarket);
      clearSignalData();
      // El historial de trades ahora se refrescará por el useEffect que depende de selectedMarket.symbol
    } else {
        console.warn(`[handleMarketChange] Mercado con ID de Binance ${marketIdBinance} no encontrado en availableMarkets.`);
    }
  }, [availableMarkets, clearSignalData]); // No es necesario setSelectedMarket en dependencias

  // ======================================================================
  // 4. TODOS LOS EFECTOS (useEffect)
  // ======================================================================

  useEffect(() => {
    fetchBinanceBalancesFromHook();
  }, [useTestnet, fetchBinanceBalancesFromHook]);

  useEffect(() => {
    if (selectedMarket?.symbol) { // selectedMarket.symbol es el formato CCXT ej: BTC/USDT
        fetchTradeHistoryFromHook({ symbol: selectedMarket.symbol, limit: 50 });
    }
  }, [selectedMarket?.symbol, useTestnet, fetchTradeHistoryFromHook]);


  // Sincronizar el historial del gráfico con los datos del hook useBinanceMarketData
  useEffect(() => {
    if (currentMarketHistoryFromHook && currentMarketHistoryFromHook.length > 0) {
      setCurrentMarketPriceHistory(currentMarketHistoryFromHook);
    } else if (!isMarketDataLoading && !marketDataError) {
      setCurrentMarketPriceHistory([]);
    }
  }, [currentMarketHistoryFromHook, isMarketDataLoading, marketDataError]);


  // Efecto para simulación de precios de mercados NO BTCUSDT (mantener si es útil para UI)
  useEffect(() => {
    if (selectedMarket?.id === "BTCUSDT") { // Usa el ID de Binance para esta lógica
      if (marketPriceUpdateIntervalRef.current) {
        window.clearInterval(marketPriceUpdateIntervalRef.current);
        marketPriceUpdateIntervalRef.current = null;
      }
      return;
    }

    if (marketPriceUpdateIntervalRef.current) {
      window.clearInterval(marketPriceUpdateIntervalRef.current);
    }

    marketPriceUpdateIntervalRef.current = window.setInterval(() => {
      setCurrentMarketPriceHistory(prevHistory => {
        if (prevHistory.length === 0) return prevHistory;
        const lastPricePoint = prevHistory[prevHistory.length - 1];
        const basePrice = lastPricePoint.price;
        let fluctuationFactor = 0.0001;
        if (selectedMarket?.baseAsset === 'ETH') fluctuationFactor = 0.0005;
        else if (selectedMarket?.baseAsset && !['BTC', 'ETH'].includes(selectedMarket.baseAsset)) fluctuationFactor = 0.001;

        const randomFluctuation = (Math.random() - 0.5) * basePrice * fluctuationFactor * (Math.random() > 0.9 ? 10 : 1);
        const newPrice = Math.max(0.00001, basePrice + randomFluctuation);

        const newPoint = { timestamp: Math.floor(Date.now() / 1000), price: newPrice, volume: 0 };
        return [...prevHistory, newPoint].slice(-PRICE_HISTORY_POINTS_TO_KEEP);
      });
    }, Math.random() * 1500 + 1500);

    return () => {
      if (marketPriceUpdateIntervalRef.current) {
        window.clearInterval(marketPriceUpdateIntervalRef.current);
        marketPriceUpdateIntervalRef.current = null;
      }
    };
  }, [selectedMarket?.id, selectedMarket?.baseAsset]);

  // Efecto para obtener detalles del mercado (libro de órdenes, trades recientes del mercado)
  useEffect(() => {
    const fetchMarketDetails = async () => {
      if (!selectedMarket?.id) { // Usa el ID de Binance
        setOrderBookData(null);
        setRecentTrades([]);
        return;
      }
      const marketSymbolForAPI = selectedMarket.id; // Ej: BTCUSDT

      // Fetch Libro de Órdenes (si tuvieras un endpoint de depth)
      // Ejemplo: /api/binance/depth?symbol=${marketSymbolForAPI}&isTestnet=${useTestnet}
      // Por ahora lo omitimos si no está implementado

      // Fetch Trades Recientes del Mercado (si tuvieras un endpoint de recent-trades del mercado)
      // Ejemplo: /api/binance/recent-trades?symbol=${marketSymbolForAPI}&isTestnet=${useTestnet}
      // Por ahora lo omitimos si no está implementado
    };
    fetchMarketDetails();
  }, [selectedMarket?.id, useTestnet]);

  const currentBaseAssetBalance = useMemo(() => {
    if (allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.baseAsset]) {
      return allBinanceBalances[selectedMarket.baseAsset].available || 0;
    }
    return 0;
  }, [allBinanceBalances, selectedMarket]);

  const currentQuoteAssetBalance = useMemo(() => {
    if (allBinanceBalances && selectedMarket && allBinanceBalances[selectedMarket.quoteAsset]) {
      return allBinanceBalances[selectedMarket.quoteAsset].available || 0;
    }
    return 0;
  }, [allBinanceBalances, selectedMarket]);

  const totalPortfolioValue = useMemo(() => {
    if (allBinanceBalances && selectedMarket) {
      let totalValue = 0;
      // Sumar valor de todos los activos en términos de USDT (o el quoteAsset principal)
      // Esta es una simplificación. Una conversión real necesitaría precios de todos los pares.
      Object.entries(allBinanceBalances).forEach(([asset, balance]) => {
        if (asset === selectedMarket.quoteAsset) {
          totalValue += balance.available;
        } else if (asset === selectedMarket.baseAsset && currentMarketPrice) {
          totalValue += balance.available * currentMarketPrice;
        }
        // Para otros activos, necesitarías sus precios vs USDT
      });
      return totalValue;
    }
    return null;
  }, [allBinanceBalances, selectedMarket, currentMarketPrice]);

  let centralColSpan = 'md:col-span-12';
  if (isLeftSidebarOpen && isRightSidebarOpen) {
    centralColSpan = 'md:col-span-6';
  } else if (isLeftSidebarOpen || isRightSidebarOpen) {
    centralColSpan = 'md:col-span-9';
  }

  // Determinar el balance de USDT para la AppHeader
  const usdtBalanceForHeader = useMemo(() => {
    if (allBinanceBalances && allBinanceBalances['USDT']) {
      return allBinanceBalances['USDT'].available;
    }
    return null;
  }, [allBinanceBalances]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <AppHeader
        toggleLeftSidebar={toggleLeftSidebar}
        isLeftSidebarOpen={isLeftSidebarOpen}
        toggleRightSidebar={toggleRightSidebar}
        isRightSidebarOpen={isRightSidebarOpen}
        portfolioBalance={usdtBalanceForHeader}
        isBotRunning={isBotRunning}
        toggleBotStatus={toggleBotStatus}
        isBinanceBalancesLoading={isBinanceBalancesLoading}
        binanceBalancesError={binanceBalancesError}
        // NO SE PASAN useTestnet NI setUseTestnet a AppHeader
      />

      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem-2rem)]">
          <aside className={`col-span-12 ${isLeftSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
            <ScrollArea className="flex-1 pr-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><PackageSearch className="w-4 h-4 mr-2" />Libro de Órdenes</CardTitle>
                  <CardDescription className="text-xs">Profundidad del mercado ({selectedMarket?.name})</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  {isLoadingOrderBook ? (
                    <p>Cargando Libro de Órdenes...</p>
                  ) : orderBookError ? (
                    <p className="text-red-500">Error: {orderBookError}</p>
                  ) : orderBookData ? (
                    <p>Libro de Órdenes (Datos Cargados - Implementar Display)</p>
                  ) : (
                    <p>(Libro de Órdenes No Disponible)</p>
                  )}
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><LineChart className="w-4 h-4 mr-2" />Trades del Mercado</CardTitle>
                  <CardDescription className="text-xs">Últimas transacciones ({selectedMarket?.name}).</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                   {isLoadingRecentTrades ? (
                      <p>Cargando Trades Recientes...</p>
                   ) : recentTradesError ? (
                       <p className="text-red-500">Error: {recentTradesError}</p>
                   ) : recentTrades && recentTrades.length > 0 ? (
                      <p>Trades del Mercado (Datos Cargados - Implementar Display)</p>
                   ) : (
                       <p>(Trades Recientes No Disponibles)</p>
                   )}
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <TradeHistoryTable trades={tradeHistory || []} />
            </ScrollArea>
          </aside>

          <section className={`col-span-12 ${centralColSpan} p-1 md:p-2 flex flex-col gap-2 transition-all duration-300 ease-in-out`}>
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket?.id} // Usa el ID de Binance para el key
                marketId={selectedMarket?.id || "BTCUSDT"} // Pasa el ID de Binance
                marketName={selectedMarket?.name || "BTC/USDT"}
                priceHistory={currentMarketPriceHistory}
                smaCrossoverEvents={smaCrossoverEvents}
                aiSignalEvents={botSignalEvents}
                isBotActive={isBotRunning}
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <Card className="col-span-1 shadow-lg h-full">
                 <CardHeader>
                  <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" /> Órdenes de Mercado ({useTestnet ? 'Testnet' : 'Mainnet'})</CardTitle>
                  <CardDescription>Realiza órdenes de compra/venta directamente en Binance.</CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100%-6.5rem)] flex items-center justify-center">
                  {selectedMarket && (
                    <TradeForm
                      market={selectedMarket} // Pasa el objeto Market completo
                      currentPrice={currentMarketPrice}
                      availableQuoteBalance={currentQuoteAssetBalance}
                      availableBaseBalance={currentBaseAssetBalance}
                      onPlaceOrder={handlePlaceOrder}
                      isLoadingTrade={isLoadingTrade}
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
                selectedMarketId={selectedMarket?.id || "BTCUSDT"} // Usa el ID de Binance
                onMarketChange={handleMarketChange} // handleMarketChange espera el ID de Binance
              />
              <Separator className="my-4" />

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
              <Separator className="my-4" />

              <Tabs defaultValue="bot-controls" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-2">
                  <TabsTrigger value="bot-controls"><BotIcon className="w-4 h-4 mr-1" />Control Bot</TabsTrigger>
                  <TabsTrigger value="balance"><Wallet className="w-4 h-4 mr-1" />Portafolio</TabsTrigger>
                  <TabsTrigger value="metric-guide"><BookOpen className="w-4 h-4 mr-1" />Guía</TabsTrigger>
                </TabsList>

                <TabsContent value="bot-controls">
                    <BotControls
                        isBotRunning={isBotRunning}
                        onToggleBot={toggleBotStatus}
                        isLoadingAiSignals={isLoadingBotSignals}
                        onGenerateSignals={() => console.log("Generar Señales IA Manual (TODO)")} // Placeholder
                        aiSignalError={botError}
                        useTestnet={useTestnet} // Pasar useTestnet
                        selectedMarketSymbol={selectedMarket?.symbol}
                        marketRulesError={marketRulesError} // Pasar error de reglas
                        areMarketRulesLoaded={!!selectedMarketRules} // Pasar estado de carga de reglas
                    />
                    <SignalDisplay
                        signalData={botSignalData}
                        isLoading={isLoadingBotSignals}
                        error={botError}
                    />
                </TabsContent>

                <TabsContent value="balance">
                  <BalanceCard
                    title={`Balance ${selectedMarket?.quoteAsset || "Quote"} (Binance)`}
                    description={`Tu saldo disponible en ${selectedMarket?.quoteAsset || "Quote"} en Binance (${useTestnet ? 'Testnet' : 'Mainnet'}).`}
                    balance={currentQuoteAssetBalance}
                    asset={selectedMarket?.quoteAsset || "USD"}
                    isLoading={isBinanceBalancesLoading}
                    error={binanceBalancesError}
                  />
                  <PerformanceChart portfolioValue={totalPortfolioValue} />
                  <BinanceBalancesDisplay
                    balances={allBinanceBalances || {}}
                    isLoading={isBinanceBalancesLoading}
                    error={binanceBalancesError}
                    useTestnet={useTestnet} // Pasar useTestnet
                  />
                  {selectedMarket && (
                    <Card className="mt-4">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm flex items-center"><Activity className="w-4 h-4 mr-2 text-primary" />{selectedMarket.name}</CardTitle>
                        <CardDescription className="text-xs">Información del Activo ({useTestnet ? 'Testnet' : 'Mainnet'})</CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1 pb-3">
                        <p>Balance {selectedMarket.baseAsset}: <span className="font-semibold">{currentBaseAssetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' ? 8 : 6 })}</span></p>
                        <p>Precio Actual: <span className="font-semibold text-primary">${(latestPriceForPnl)?.toLocaleString('en-US', { minimumFractionDigits: selectedMarket.pricePrecision || 2, maximumFractionDigits: selectedMarket.pricePrecision || 5 }) || 'N/A'}</span></p>
                        <p>Cambio 24h: <span className={(selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                        {/* <p>Volumen 24h: N/A (datos reales próximamente)</p> */}
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
                        <AccordionItem value="price-line">
                            <AccordionTrigger>Línea de Precio (Gráfico Principal)</AccordionTrigger>
                            <AccordionContent>
                                <p>Representa el precio de cierre del activo ({selectedMarket?.name}) para cada intervalo de tiempo (ej. 1 minuto) en el período visualizado.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma-lines">
                            <AccordionTrigger>Medias Móviles Simples (SMA)</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-1">Las SMAs suavizan los datos de precios para mostrar la tendencia general del mercado durante un período específico.</p>
                                <ul className="list-disc pl-5 space-y-1 text-xs">
                                    <li><span className="font-semibold text-[hsl(var(--chart-5))]">SMA 10 (Corta):</span> Media de los últimos 10 precios de cierre. Reacciona más rápido a los cambios.</li>
                                    <li><span className="font-semibold text-[hsl(var(--chart-2))]">SMA 20 (Media):</span> Media de los últimos 20 precios de cierre.</li>
                                    <li><span className="font-semibold text-[hsl(var(--chart-4))]">SMA 50 (Larga):</span> Media de los últimos 50 precios de cierre. Indica la tendencia a más largo plazo. Usada por el bot como referencia.</li>
                                </ul>
                                <p className="mt-2 text-xs">Los cruces entre estas medias pueden indicar posibles puntos de compra o venta.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="macd-indicator">
                            <AccordionTrigger>Indicador MACD (Convergencia/Divergencia de Medias Móviles)</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-1">El MACD es un indicador de momentum que sigue tendencias. Muestra la relación entre dos medias móviles exponenciales (EMAs) del precio.</p>
                                <ul className="list-disc pl-5 space-y-1 text-xs">
                                    <li><span className="font-semibold text-[hsl(var(--chart-6))]">Línea MACD:</span> Diferencia entre la EMA de 12 períodos y la EMA de 26 períodos.</li>
                                    <li><span className="font-semibold text-[hsl(var(--chart-7))]">Línea de Señal:</span> EMA de 9 períodos de la Línea MACD.</li>
                                    <li><span className="font-semibold">Histograma MACD:</span> Diferencia entre la Línea MACD y la Línea de Señal. Barras verdes indican momentum alcista, rojas indican momentum bajista.</li>
                                </ul>
                                <p className="mt-2 text-xs">Los cruces de la Línea MACD sobre la Línea de Señal, o los cambios en el histograma, pueden generar señales de trading.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="bot-signals"> 
                          <AccordionTrigger>Señales del Bot (Puntos Sólidos)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Los puntos <span className="font-semibold text-green-400">verdes sólidos</span> (COMPRA) y <span className="font-semibold text-red-400">rojos sólidos</span> (VENTA) en el gráfico representan las señales generadas por la <span className="font-semibold">estrategia actual de tu bot</span> (basada en SMA/MACD u otras que configures) que han desencadenado una <span className="font-semibold">operación REAL por el bot</span> (si está "iniciado").</p>
                            <p className="mb-2 text-xs">El bot evalúa los indicadores y, si se cumplen las condiciones de la estrategia, ejecuta una orden en Binance.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma-crossover-signals">
                          <AccordionTrigger>Señales de Cruce SMA (Puntos Claros)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Los puntos <span className="font-semibold text-green-600">verdes claros</span> y <span className="font-semibold text-red-600">rojos claros</span> indican cruces técnicos de las medias móviles (SMA10 vs SMA20) que se calculan visualmente en el gráfico. Pueden o no coincidir con las decisiones finales del bot, ya que el bot podría usar más factores o diferentes umbrales.</p>
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
         © {new Date().getFullYear()} CryptoPilot. {useTestnet ? 'Operando en Binance Testnet.' : 'Operando en Binance Mainnet.'} Las operaciones son reales.
      </footer>
    </div>
  );
}
