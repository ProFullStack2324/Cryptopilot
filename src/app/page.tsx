
"use client";

import { useState, useEffect } from "react";
import type { AISignalData, Market, OrderFormData, Trade, MarketPriceDataPoint, SignalEvent } from "@/lib/types";
import { mockMarkets, mockMarketPriceHistory, initialMockTrades } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TradeHistoryTable } from "@/components/dashboard/trade-history-table";
import { BotControls } from "@/components/dashboard/bot-controls";
import { SignalDisplay } from "@/components/dashboard/signal-display";
import { handleGenerateSignalsAction } from "./actions";
import { MarketSelector } from "@/components/trading/market-selector";
import { MarketPriceChart } from "@/components/trading/market-price-chart";
import { OrderForm } from "@/components/trading/order-form"; // Added missing import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, PackageSearch, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNAL_EVENTS_ON_CHART = 5; 

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


  useEffect(() => {
    const initialQuote = Math.random() * 25000 + 5000;
    setAvailableQuoteBalance(initialQuote);
    const defaultMarketBaseBalance = Math.random() * (mockMarkets[0].baseAsset === 'BTC' ? 0.5 : 10) + 0.1;
    setCurrentBaseAssetBalance(defaultMarketBaseBalance);
  }, []);

  useEffect(() => {
    setCurrentMarketPriceHistory(mockMarketPriceHistory[selectedMarket.id] || []);
    setSignalEvents([]); 
  }, [selectedMarket]);


  const handleMarketChange = (marketId: string) => {
    const newMarket = mockMarkets.find(m => m.id === marketId);
    if (newMarket) {
      setSelectedMarket(newMarket);
      clearSignalData();
      setCurrentBaseAssetBalance(Math.random() * (newMarket.baseAsset === 'BTC' ? 0.5 : 10) + 0.1);
    }
  };

  const handleSignalsGenerated = (data: AISignalData) => {
    setAiSignalData(data);
    setIsLoadingAiSignals(false);
    setAiError(null);

    try {
      const signalsArray = JSON.parse(data.signals);
      if (Array.isArray(signalsArray)) {
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
      console.error("Error parsing signals for chart events:", e);
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
      // setIsLoadingAiSignals(false); // Managed in callbacks
    }
  };

  const handlePlaceOrder = (orderData: OrderFormData) => {
    const priceToUse = orderData.price || selectedMarket.latestPrice || 0;
    const totalCostOrProceeds = orderData.amount * priceToUse;

    const newTrade: Trade = {
      id: (tradeHistory.length + 1).toString() + Date.now().toString(),
      date: new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      type: orderData.type === 'buy' ? 'Compra' : 'Venta',
      asset: selectedMarket.name,
      amount: orderData.amount,
      price: priceToUse,
      total: totalCostOrProceeds,
      status: 'Completado',
    };

    if (orderData.type === 'buy') {
      if (availableQuoteBalance !== null && availableQuoteBalance >= totalCostOrProceeds) {
        setAvailableQuoteBalance(availableQuoteBalance - totalCostOrProceeds);
        setCurrentBaseAssetBalance(currentBaseAssetBalance + orderData.amount);
        setTradeHistory(prev => [newTrade, ...prev]);
        toast({
          title: "Orden de Compra (Simulada) Exitosa",
          description: `Comprados ${orderData.amount} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Fondos Insuficientes (Simulado)",
          description: `No tienes suficiente ${selectedMarket.quoteAsset} para comprar ${orderData.amount} ${selectedMarket.baseAsset}.`,
          variant: "destructive"
        });
        return;
      }
    } else { 
      if (currentBaseAssetBalance >= orderData.amount) {
        setCurrentBaseAssetBalance(currentBaseAssetBalance - orderData.amount);
        setAvailableQuoteBalance((availableQuoteBalance || 0) + totalCostOrProceeds);
        setTradeHistory(prev => [newTrade, ...prev]);
        toast({
          title: "Orden de Venta (Simulada) Exitosa",
          description: `Vendidos ${orderData.amount} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Fondos Insuficientes (Simulado)",
          description: `No tienes suficiente ${selectedMarket.baseAsset} para vender ${orderData.amount}.`,
          variant: "destructive"
        });
        return;
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem)]">
          
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

          <section className="col-span-12 md:col-span-6 p-1 md:p-2 flex flex-col gap-2">
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                key={selectedMarket.id} 
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
              />
            </div>
          </section>

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
                  <TabsTrigger value="balance">Saldo</TabsTrigger>
                </TabsList>
                <TabsContent value="ai-controls">
                   <BotControls 
                    onSignalsGenerated={handleSignalsGenerated} 
                    onGenerationError={handleGenerationError}
                    clearSignalData={clearSignalData}
                    generateSignalsAction={generateSignalsActionWrapper} 
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
                          <p>Precio Actual: <span className="font-semibold text-primary">${selectedMarket.latestPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5}) || 'N/A'}</span></p>
                          <p>Cambio 24h: <span className={ (selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                          <p>Volumen 24h (Simulado): ${(Math.random() * 100000000).toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                        </CardContent>
                      </Card>
                  )}
                </TabsContent>
              </Tabs>
             
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

