
"use client";

import { useState, useEffect } from "react";
import type { AISignalData, Market, OrderFormData, Trade, MarketPriceDataPoint, SignalEvent, SimulatedPosition } from "@/lib/types";
import { mockMarkets, mockMarketPriceHistory, initialMockTrades } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TradeHistoryTable } from "@/components/dashboard/trade-history-table";
import { BotControls } from "@/components/dashboard/bot-controls";
import { SignalDisplay } from "@/components/dashboard/signal-display";
import { handleGenerateSignalsAction } from "./actions";
import { MarketSelector } from "@/components/trading/market-selector";
import { MarketPriceChart } from "@/components/trading/market-price-chart";
import { OrderForm } from "@/components/trading/order-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, PackageSearch, Info, TrendingUp, TrendingDown, WalletCards } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNAL_EVENTS_ON_CHART = 5;

// Nuevo componente para mostrar P&L
function SimulatedPnLDisplay({ position, currentPrice, market }: { position: SimulatedPosition | null; currentPrice: number | undefined; market: Market | null }) {
  if (!position || currentPrice === undefined || !market) {
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

  if (position.type === 'buy') { // Comprado activo base, esperando que suba
    pnl = (currentPrice - position.entryPrice) * position.amount;
  } else { // Vendido activo base (short), esperando que baje
    pnl = (position.entryPrice - currentPrice) * position.amount;
  }

  if (position.entryPrice > 0) {
    pnlPercentage = (pnl / (position.entryPrice * position.amount)) * 100;
  }

  const pnlColor = pnl >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <Card className="mt-4 shadow-md">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm flex items-center">
           {position.type === 'buy' ? <TrendingUp className="w-4 h-4 mr-2 text-green-500"/> : <TrendingDown className="w-4 h-4 mr-2 text-red-500"/>}
          P&L Posición {market.baseAsset} (Sim.)
        </CardTitle>
        <CardDescription className="text-xs">
          Entrada: ${position.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 5})} | Cant.: {position.amount.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits: 6})}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-1 pb-3">
        <p className={`font-semibold text-lg ${pnlColor}`}>
          {pnl.toLocaleString(undefined, { style: 'currency', currency: quoteAsset, minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className={`ml-2 text-xs ${pnlColor}`}>({pnlPercentage.toFixed(2)}%)</span>
        </p>
        <p className="text-xs text-muted-foreground">Precio Actual: ${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 5})}</p>
      </CardContent>
    </Card>
  );
}


export default function TradingPlatformPage() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(mockMarkets[0]);
  const [aiSignalData, setAiSignalData] = useState<AISignalData | null>(null);
  const [isLoadingAiSignals, setIsLoadingAiSignals] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();

  const [availableQuoteBalance, setAvailableQuoteBalance] = useState<number | null>(null);
  const [currentBaseAssetBalance, setCurrentBaseAssetBalance] = useState<number>(0);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>(initialMockTrades);
  const [signalEvents, setSignalEvents] = useState<SignalEvent[]>([]);
  const [currentMarketPriceHistory, setCurrentMarketPriceHistory] = useState<MarketPriceDataPoint[]>(
    mockMarketPriceHistory[mockMarkets[0].id] || []
  );
  const [currentSimulatedPosition, setCurrentSimulatedPosition] = useState<SimulatedPosition | null>(null);


  useEffect(() => {
    const initialQuote = Math.random() * 25000 + 5000;
    setAvailableQuoteBalance(initialQuote);
    const defaultMarketBaseBalance = Math.random() * (mockMarkets[0].baseAsset === 'BTC' ? 0.5 : 10) + 0.1;
    setCurrentBaseAssetBalance(defaultMarketBaseBalance);
  }, []);

  useEffect(() => {
    setCurrentMarketPriceHistory(mockMarketPriceHistory[selectedMarket.id] || []);
    setSignalEvents([]);
    setCurrentSimulatedPosition(null); // Cerrar posición simulada al cambiar de mercado
  }, [selectedMarket]);


  const handleMarketChange = (marketId: string) => {
    const newMarket = mockMarkets.find(m => m.id === marketId);
    if (newMarket) {
      setSelectedMarket(newMarket);
      clearSignalData();
      // Simular un nuevo balance para el activo base del nuevo mercado
      const newBaseBalance = Math.random() * (newMarket.baseAsset === 'BTC' ? 0.2 : 5) + (newMarket.baseAsset === 'BTC' ? 0.01 : 0.5);
      setCurrentBaseAssetBalance(newBaseBalance);
    }
  };

  const handleSignalsGenerated = (data: AISignalData) => {
    setAiSignalData(data);
    setIsLoadingAiSignals(false);
    setAiError(null);

    try {
      const signalsArray = JSON.parse(data.signals);
      if (Array.isArray(signalsArray) && currentMarketPriceHistory.length > 0) {
        const latestPricePoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
        if (!latestPricePoint) return;

        const newEvents: SignalEvent[] = signalsArray
          .filter(s => s.signal === 'BUY' || s.signal === 'SELL')
          .map(s => ({
            timestamp: latestPricePoint.timestamp,
            price: latestPricePoint.price,
            type: s.signal as 'BUY' | 'SELL',
            confidence: s.confidence,
          }));

        setSignalEvents(prevEvents => [...prevEvents, ...newEvents].slice(-MAX_SIGNAL_EVENTS_ON_CHART));
      }
    } catch (e) {
      console.error("Error al analizar señales para eventos del gráfico:", e);
    }
  };

  const handleGenerationError = (errorMsg: string) => {
    setAiSignalData(null);
    setIsLoadingAiSignals(false);
    setAiError(errorMsg);
  };

  const clearSignalData = () => {
    setAiSignalData(null);
    setAiError(null);
  }

  const generateSignalsActionWrapper = async (input: any) => {
    setIsLoadingAiSignals(true);
    setAiError(null);
    try {
      return await handleGenerateSignalsAction(input);
    } finally {
      // setIsLoadingAiSignals(false); // Se maneja en los callbacks
    }
  };

  const handlePlaceOrder = (orderData: OrderFormData) => {
    const priceToUse = orderData.orderType === 'limit' && orderData.price ? orderData.price : (currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price : selectedMarket.latestPrice || 0);
    if (priceToUse <= 0) {
      toast({ title: "Error de Precio", description: "No se pudo determinar un precio válido para la orden.", variant: "destructive" });
      return;
    }
    const totalCostOrProceeds = orderData.amount * priceToUse;

    const newTrade: Trade = {
      id: (tradeHistory.length + 1).toString() + Date.now().toString(),
      date: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: orderData.type === 'buy' ? 'Compra' : 'Venta',
      asset: selectedMarket.name,
      amount: orderData.amount,
      price: priceToUse,
      total: totalCostOrProceeds,
      status: 'Completado', // Todas las simulaciones son completadas instantáneamente
    };

    if (orderData.type === 'buy') {
      if (availableQuoteBalance !== null && availableQuoteBalance >= totalCostOrProceeds) {
        setAvailableQuoteBalance(availableQuoteBalance - totalCostOrProceeds);
        setCurrentBaseAssetBalance(currentBaseAssetBalance + orderData.amount);
        setTradeHistory(prev => [newTrade, ...prev]);
        setCurrentSimulatedPosition({
          marketId: selectedMarket.id,
          entryPrice: priceToUse,
          amount: orderData.amount,
          type: 'buy',
          timestamp: Math.floor(Date.now() / 1000)
        });
        toast({
          title: "Orden de Compra (Simulada) Exitosa",
          description: `Comprados ${orderData.amount} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
      } else {
        toast({ title: "Fondos Insuficientes (Simulado)", description: `No tienes suficiente ${selectedMarket.quoteAsset} para comprar ${orderData.amount} ${selectedMarket.baseAsset}.`, variant: "destructive" });
        return;
      }
    } else { // Venta
      if (currentBaseAssetBalance >= orderData.amount) {
        setCurrentBaseAssetBalance(currentBaseAssetBalance - orderData.amount);
        setAvailableQuoteBalance((availableQuoteBalance || 0) + totalCostOrProceeds);
        setTradeHistory(prev => [newTrade, ...prev]);
        // Simular cierre de posición si había una de compra, o abrir una de venta (short)
        // Por simplicidad, cada venta ahora crea una posición de "venta" (potencial short)
        setCurrentSimulatedPosition({
            marketId: selectedMarket.id,
            entryPrice: priceToUse,
            amount: orderData.amount,
            type: 'sell',
            timestamp: Math.floor(Date.now() / 1000)
        });
        toast({
          title: "Orden de Venta (Simulada) Exitosa",
          description: `Vendidos ${orderData.amount} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
      } else {
        toast({ title: "Fondos Insuficientes (Simulado)", description: `No tienes suficiente ${selectedMarket.baseAsset} para vender ${orderData.amount}.`, variant: "destructive" });
        return;
      }
    }
  };
  
  const latestPriceForPnl = currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price : undefined;


  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem)]">

          {/* Columna Izquierda: Libro de Órdenes (Placeholder), Trades del Mercado (Placeholder), Historial de Operaciones */}
          <aside className="col-span-12 md:col-span-3 p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto">
            <ScrollArea className="flex-1 pr-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><PackageSearch className="w-4 h-4 mr-2"/>Libro de Órdenes</CardTitle>
                  <CardDescription className="text-xs">Visualización del Libro de Órdenes (Simulación Avanzada - Próximamente).</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Simulación de Libro de Órdenes)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><LineChart className="w-4 h-4 mr-2"/>Trades del Mercado</CardTitle>
                   <CardDescription className="text-xs">Últimas transacciones en el mercado (Simulación Avanzada - Próximamente).</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                   (Simulación de Trades del Mercado)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <TradeHistoryTable trades={tradeHistory} />
            </ScrollArea>
          </aside>

          {/* Columna Central: Gráfico de Precios, Formulario de Órdenes */}
          <section className="col-span-12 md:col-span-6 p-1 md:p-2 flex flex-col gap-2">
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket.id} // Clave para forzar el re-renderizado del gráfico al cambiar de mercado
                marketId={selectedMarket.id}
                marketName={selectedMarket.name}
                initialPriceHistory={currentMarketPriceHistory}
                signalEvents={signalEvents}
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <OrderForm
                market={selectedMarket}
                balanceQuoteAsset={availableQuoteBalance || 0}
                balanceBaseAsset={currentBaseAssetBalance}
                onSubmit={handlePlaceOrder}
                currentPrice={latestPriceForPnl}
              />
            </div>
          </section>

          {/* Columna Derecha: Selector de Mercado, Pestañas (Control IA, Saldo), P&L, Señales IA */}
          <aside className="col-span-12 md:col-span-3 p-2 flex flex-col gap-2 border-l border-border bg-card/30 overflow-y-auto">
            <ScrollArea className="flex-1 pr-2">
              <MarketSelector
                markets={mockMarkets}
                selectedMarketId={selectedMarket.id}
                onMarketChange={handleMarketChange}
              />
              <Separator className="my-4" />
              <Tabs defaultValue="ai-controls" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-2">
                  <TabsTrigger value="ai-controls">Control IA</TabsTrigger>
                  <TabsTrigger value="balance">Info. Activo</TabsTrigger>
                </TabsList>
                <TabsContent value="ai-controls">
                   <BotControls
                    onSignalsGenerated={handleSignalsGenerated}
                    onGenerationError={handleGenerationError}
                    clearSignalData={clearSignalData}
                    generateSignalsAction={generateSignalsActionWrapper}
                    selectedMarketSymbol={selectedMarket.baseAsset}
                  />
                </TabsContent>
                <TabsContent value="balance">
                  <BalanceCard balance={availableQuoteBalance} asset={`${selectedMarket.quoteAsset} (Total Estimado)`} />
                  {selectedMarket && (
                     <Card className="mt-4">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center"><Info className="w-4 h-4 mr-2 text-primary"/>{selectedMarket.name}</CardTitle>
                          <CardDescription>Información del Activo (Simulada)</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <p>Precio Actual: <span className="font-semibold text-primary">${(currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price : selectedMarket.latestPrice)?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5}) || 'N/A'}</span></p>
                          <p>Cambio 24h: <span className={ (selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                          <p>Volumen 24h (Simulado): ${(Math.random() * 100000000).toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        </CardContent>
                      </Card>
                  )}
                </TabsContent>
              </Tabs>
              <SimulatedPnLDisplay position={currentSimulatedPosition} currentPrice={latestPriceForPnl} market={selectedMarket} />
               <Separator className="my-4" />
               <SignalDisplay
                signalData={aiSignalData}
                isLoading={isLoadingAiSignals}
                error={aiError}
              />
            </ScrollArea>
          </aside>
        </div>
      </main>
       <footer className="py-2 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} CryptoPilot (Simulación). Precios y balances no reales.
      </footer>
    </div>
  );
}

