
// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

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
  AppHeaderProps,
  MarketPriceChartProps,
  TradeFormProps,
  BalanceCardProps,
  Balance
} from "@/lib/types";

// Importaciones de VALORES (NO uses 'type')
import { PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types";

// Componentes UI
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// Switch y Label eliminados ya que el toggle de Testnet se va.
import { LineChart, PackageSearch, TrendingUp, TrendingDown, WalletCards, BotIcon, BookOpen, Wallet, DollarSign } from "lucide-react";
// Hooks
import { useToast } from "@/hooks/use-toast";
import { useBinanceMarketData } from "@/hooks/useBinanceMarketData";

// NUEVA IMPORTACIÓN DEL HOOK DEL BOT
import { useTradingBot } from '@/hooks/useTradingBot';
import useBinanceBalances from "@/hooks/useBinanceBalances";
import useBinanceTradeHistory from "@/hooks/useBinanceTradeHistory";

interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  datetime: string;
}

const MAX_AI_SIGNAL_EVENTS_ON_CHART = 5;
const AI_TRADE_CONFIDENCE_THRESHOLD = 0.01;
const BOT_AUTO_SIGNAL_INTERVAL_MS = 30000; // Reducido para pruebas más rápidas

const isValidSignalItem = (item: any): item is SignalItem => {
  return typeof item === 'object' && item !== null &&
    typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
    typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
};

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
  const [selectedMarket, setSelectedMarket] = useState<Market>({
    id: "BTCUSDT",
    symbol: "BTC/USDT", // CCXT usa este formato
    name: "BTC/USDT", baseAsset: "BTC", quoteAsset: "USDT", latestPrice: null, change24h: null, pricePrecision: 2
  });
  const [botSignalData, setBotSignalData] = useState<AISignalData | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [isLoadingBotSignals, setIsLoadingBotSignals] = useState(false);
  const [botSignalEvents, setBotSignalEvents] = useState<SignalEvent[]>([]);

  const [smaCrossoverEvents, setSmaCrossoverEvents] = useState<SmaCrossoverEvent[]>([]);
  const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>([]);
  const [currentSimulatedPosition, setCurrentSimulatedPosition] = useState<SimulatedPosition | null>(null);

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const [isBotRunningState, setIsBotRunningState] = useState<boolean>(false);
  const [isLoadingTrade, setIsLoadingTrade] = useState(false);

  const [orderBookData, setOrderBookData] = useState<OrderBook | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);
  const [isLoadingRecentTrades, setIsLoadingRecentTrades] = useState(false);
  const [orderBookError, setOrderBookError] = useState<string | null>(null);
  const [recentTradesError, setRecentTradesError] = useState<string | null>(null);
  
  // const [useTestnet, setUseTestnet] = useState<boolean>(false); // ELIMINADO

  const { toast } = useToast();

  const {
    marketPrice: currentMarketPrice,
    marketHistory: currentMarketHistoryFromHook,
    availableMarkets,
    isLoading: isMarketDataLoading,
    error: marketDataError, // Añadido para manejar errores del hook de datos de mercado
    // Las props timeframe y limit se gestionan internamente por el hook o se pasan si es necesario
  } = useBinanceMarketData({ // Eliminada la prop useTestnet
    symbol: selectedMarket?.id, // El hook usará este símbolo para las klines
    initialFetch: true,
  });

  const {
    balances: allBinanceBalances,
    isLoadingBalances: isBinanceBalancesLoading,
    balancesError: binanceBalancesError,
    fetchBalances: fetchBinanceBalancesFromHook,
  } = useBinanceBalances({ initialFetch: true }); // Eliminada la prop useTestnet

  const {
    tradeHistory,
    isLoadingTradeHistory,
    tradeHistoryError,
    fetchTradeHistory: fetchTradeHistoryFromHook,
  } = useBinanceTradeHistory({ // Eliminada la prop useTestnet
    initialFetch: true,
    symbol: selectedMarket?.symbol, // Pasar el símbolo CCXT
    limit: 50,
  });

  const handlePlaceOrder = useCallback(async (orderData: OrderFormData): Promise<boolean> => {
    console.log(`[handlePlaceOrder] Intentando ejecutar orden REAL (Mainnet): ${orderData.type} ${orderData.amount} de ${orderData.marketId}`);
    setIsLoadingTrade(true);
    let success = false;

    try {
        // El payload ya no necesita isTestnet, el backend /api/binance/trade opera en Mainnet por defecto ahora.
        const tradePayload = {
            symbol: selectedMarket?.symbol, // Asegurar que es el símbolo CCXT: BTC/USDT
            type: orderData.orderType,
            side: orderData.type,
            amount: orderData.amount,
            price: orderData.price, // Será undefined para órdenes de mercado
        };

        console.log("[handlePlaceOrder] Enviando payload al backend:", tradePayload);
        
        const endpoint = '/api/binance/trade'; // Siempre Mainnet

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tradePayload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            toast({
                title: `Orden de ${orderData.type === 'buy' ? 'Compra' : 'Venta'} Exitosa (Mainnet)`,
                description: `Orden ${result.orderId || ''} para ${orderData.amount} ${selectedMarket?.baseAsset || ''} @ ${orderData.price || 'Mercado'} en ${orderData.marketId}. Estado: ${result.status}.`,
                variant: "default",
            });
            success = true;
            fetchBinanceBalancesFromHook();
            if (selectedMarket?.symbol) {
              fetchTradeHistoryFromHook({ symbol: selectedMarket.symbol });
            }
        } else {
            console.error("[handlePlaceOrder] Error del backend:", result.message || result.details || 'Error desconocido');
            toast({
                title: `Error al Ejecutar Orden (Mainnet)`,
                description: result.message || result.details || 'Error reportado por el backend.',
                variant: "destructive",
            });
        }
    } catch (error: any) {
        console.error("[handlePlaceOrder] Error en la llamada fetch:", error);
        toast({
            title: "Error de Conexión",
            description: `No se pudo completar la solicitud de orden: ${error.message || 'Error desconocido.'}`,
            variant: "destructive",
        });
    } finally {
        setIsLoadingTrade(false);
    }
    return success;
  }, [
    selectedMarket,
    toast,
    fetchBinanceBalancesFromHook,
    fetchTradeHistoryFromHook,
  ]);

  const {
    isBotRunning,
    toggleBotStatus,
    botOpenPosition,
    botLastActionTimestamp,
    isPlacingOrder: isBotPlacingOrder,
    placeOrderError: botPlaceOrderError,
    selectedMarketRules,
    marketRulesError,
  } = useTradingBot({ // Eliminada la prop useTestnet
    selectedMarket,
    currentMarketPriceHistory,
    currentPrice: currentMarketPrice,
    allBinanceBalances,
    botIntervalMs: BOT_AUTO_SIGNAL_INTERVAL_MS,
    isBotRunning: isBotRunningState, // Pasar el estado
    setIsBotRunning: setIsBotRunningState, // Pasar la función para actualizar el estado
    onBotAction: async (result) => {
        if (result.type === 'orderPlaced' && result.success) {
            console.log("[Page - onBotAction] Orden del bot colocada con éxito, refrescando balances e historial.");
            fetchBinanceBalancesFromHook();
            if (selectedMarket?.symbol) {
              fetchTradeHistoryFromHook({ symbol: selectedMarket.symbol });
            }
        }
    }
  });

  const clearSignalData = useCallback(() => {
    setBotSignalData(null);
    setBotError(null);
    setBotSignalEvents([]);
    setSmaCrossoverEvents([]);
  }, []);

  const handleGenerationError = useCallback((errorMsg: string, isAutoCall: boolean = false) => {
    setBotSignalData(null);
    setBotError(errorMsg);
    if (!isAutoCall) {
      toast({ title: "Error al Generar Señales del Bot", description: errorMsg, variant: "destructive" });
    } else {
      console.error("Error en ciclo automático del Bot:", errorMsg);
      toast({ title: "Error en Ciclo del Bot", description: `Fallo al analizar ${selectedMarket?.name}. Revise la consola.`, variant: "destructive", duration: 3000 });
    }
  }, [toast, selectedMarket?.name]);

  const latestPriceForPnl = useMemo(() => {
    if (currentMarketPrice !== null) return currentMarketPrice;
    if (currentMarketPriceHistory.length > 0) {
      return currentMarketPriceHistory[currentMarketPriceHistory.length - 1]?.price || null;
    }
    return null;
  }, [currentMarketPrice, currentMarketPriceHistory]);
 
  const toggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const toggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);

  const handleMarketChange = useCallback((marketIdBinance: string) => {
    const newMarket = availableMarkets.find((m: Market) => m.id === marketIdBinance);
    if (newMarket) {
      console.log(`[handleMarketChange] Cambiando a mercado: ${newMarket.name} (ID Binance: ${newMarket.id}, Símbolo CCXT: ${newMarket.symbol})`);
      setSelectedMarket(newMarket);
      clearSignalData();
    } else {
        console.warn(`[handleMarketChange] Mercado con ID de Binance ${marketIdBinance} no encontrado en availableMarkets.`);
    }
  }, [availableMarkets, clearSignalData]);

  useEffect(() => {
    fetchBinanceBalancesFromHook();
  }, [fetchBinanceBalancesFromHook]);

  useEffect(() => {
    if (selectedMarket?.symbol) {
      fetchTradeHistoryFromHook({ symbol: selectedMarket.symbol, limit: 50 });
    }
  }, [selectedMarket?.symbol, fetchTradeHistoryFromHook]);

  useEffect(() => {
    if (currentMarketHistoryFromHook && currentMarketHistoryFromHook.length > 0) {
      setCurrentMarketPriceHistory(currentMarketHistoryFromHook);
    } else if (!isMarketDataLoading && !marketDataError) {
      setCurrentMarketPriceHistory([]);
    }
  }, [currentMarketHistoryFromHook, isMarketDataLoading, marketDataError]);

  useEffect(() => {
    const fetchMarketDetails = async () => {
      if (!selectedMarket?.id) {
         setOrderBookData(null);
        setRecentTrades([]);
        return;
      }
     };
    fetchMarketDetails();
  }, [selectedMarket?.id]);

  const currentBaseAssetBalance = useMemo<number>(() => {
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
    if (allBinanceBalances && selectedMarket && currentMarketPrice) {
      let totalValue = 0;
      Object.entries(allBinanceBalances).forEach(([asset, balance]) => {
        if (asset === selectedMarket.quoteAsset) {
          totalValue += balance.available;
        } else if (asset === selectedMarket.baseAsset && currentMarketPrice) {
          totalValue += balance.available * currentMarketPrice;
        }
      });
      return totalValue;
    }
    return null;
  }, [allBinanceBalances, selectedMarket, currentMarketPrice]);

  const usdtBalanceForHeader = useMemo(() => {
    if (allBinanceBalances && allBinanceBalances['USDT']) {
      return allBinanceBalances['USDT'].available;
    }
    return null;
  }, [allBinanceBalances]);

  // Calcular las clases del grid central dinámicamente
  const centralColSpan = useMemo(() => {
    if (isLeftSidebarOpen && isRightSidebarOpen) return "md:col-span-6";
    if (isLeftSidebarOpen || isRightSidebarOpen) return "md:col-span-9";
    return "md:col-span-12";
  }, [isLeftSidebarOpen, isRightSidebarOpen]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
       <AppHeader
        toggleLeftSidebar={toggleLeftSidebar}
        isLeftSidebarOpen={isLeftSidebarOpen}
        toggleRightSidebar={toggleRightSidebar}
        isRightSidebarOpen={isRightSidebarOpen}
        portfolioBalance={usdtBalanceForHeader}
        isBotRunning={isBotRunning} // Usar el estado del hook useTradingBot
        toggleBotStatus={toggleBotStatus} // Usar la función del hook useTradingBot
        isBinanceBalancesLoading={isBinanceBalancesLoading}
        binanceBalancesError={binanceBalancesError}
      />
      <main className="flex-1 overflow-hidden">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem-2rem)]"> {/* Ajuste de altura para footer */}
           <aside className={`col-span-12 ${isLeftSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out custom-scrollbar`}>
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
             <TradeHistoryTable trades={tradeHistory || []} isLoading={isLoadingTradeHistory} error={tradeHistoryError} />
          </aside>

          <section className={`col-span-12 ${centralColSpan} p-1 md:p-2 flex flex-col gap-2 transition-all duration-300 ease-in-out`}>
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket?.id}
                marketId={selectedMarket?.id || "BTCUSDT"}
                marketName={selectedMarket?.name || "BTC/USDT"}
                priceHistory={currentMarketPriceHistory}
                smaCrossoverEvents={smaCrossoverEvents}
                aiSignalEvents={botSignalEvents}
                isBotActive={isBotRunning} // Usar el estado del hook
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <Card className="col-span-1 shadow-lg h-full">
                 <CardHeader>
                   <CardTitle className="flex items-center"><DollarSign className="w-5 h-5 mr-2" />Órdenes de Mercado (Mainnet)</CardTitle>
                  <CardDescription>Realiza órdenes de compra/venta directamente en Binance.</CardDescription>
                 </CardHeader>
                <CardContent className="h-[calc(100%-6.5rem)] flex items-center justify-center">
                  {selectedMarket && (
                    <TradeForm
                      market={selectedMarket}
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
              <MarketSelector
                 markets={availableMarkets}
                selectedMarketId={selectedMarket?.id || "BTCUSDT"}
                onMarketChange={handleMarketChange}
              />
             <Separator className="my-2" />
              {/* Card para el Switch de Testnet ELIMINADO */}
              <Tabs defaultValue="bot-controls" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-2">
                  <TabsTrigger value="bot-controls"><BotIcon className="w-4 h-4 mr-1" />Control Bot</TabsTrigger>
                  <TabsTrigger value="balance"><Wallet className="w-4 h-4 mr-1" />Portafolio</TabsTrigger>
                  <TabsTrigger value="metric-guide"><BookOpen className="w-4 h-4 mr-1" />Guía</TabsTrigger>
                </TabsList>

                <TabsContent value="bot-controls">
                    <BotControls
                        isBotRunning={isBotRunning} // Usar el estado del hook
                        onToggleBot={toggleBotStatus} // Usar la función del hook
                        // onGenerateSignals ya no se necesita aquí si el bot es automático
                        isLoadingAiSignals={isLoadingBotSignals} // Mantener si se usa para mostrar carga de señales AI (si es una feature separada)
                        aiSignalError={botError} // Mantener
                        selectedMarketSymbol={selectedMarket?.symbol}
                        marketRulesError={marketRulesError}
                        areMarketRulesLoaded={!!selectedMarketRules}
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
                    description={`Tu saldo disponible en ${selectedMarket?.quoteAsset || "Quote"} en Binance (Mainnet).`}
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
                  />
                  {selectedMarket && (
                    <Card className="mt-4">
                       <CardHeader className="pb-2 pt-3">
                         <CardTitle className="text-sm">Activo: {selectedMarket.baseAsset}</CardTitle>
                         <CardDescription className="text-xs">Información del Activo (Mainnet)</CardDescription>
                       </CardHeader>
                       <CardContent className="text-xs space-y-1">
                        <p>Balance {selectedMarket.baseAsset}: <span className="font-semibold">{currentBaseAssetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' ? 8 : 6 })}</span></p>
                        <p>Precio Actual: <span className="font-semibold text-primary">${(latestPriceForPnl)?.toLocaleString('en-US', { minimumFractionDigits: selectedMarket.pricePrecision || 2, maximumFractionDigits: selectedMarket.pricePrecision || 5 }) || 'N/A'}</span></p>
                        <p>Cambio 24h: <span className={(selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
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
           </aside>
         </div>
      </main>
      <footer className="py-2 text-center text-xs text-muted-foreground border-t border-border">
         © {new Date().getFullYear()} CryptoPilot. Operando en Binance Mainnet. Las operaciones son reales.
     </footer>
    </div>
  );
}
