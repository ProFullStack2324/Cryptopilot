
"use client";

import { useState, useEffect } from "react";
import type { AISignalData, Market, OrderFormData } from "@/lib/types";
import { mockMarkets, mockMarketPriceHistory } from "@/lib/types"; // Importar mercados
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
import { LineChart, PackageSearch } from "lucide-react";

export default function TradingPlatformPage() {
  const [selectedMarket, setSelectedMarket] = useState<Market>(mockMarkets[0]);
  const [aiSignalData, setAiSignalData] = useState<AISignalData | null>(null);
  const [isLoadingAiSignals, setIsLoadingAiSignals] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Simulación de saldo general
  const [totalBalanceUSD, setTotalBalanceUSD] = useState<number | null>(null);

  useEffect(() => {
    // Simula la obtención del saldo
    setTotalBalanceUSD(Math.random() * 25000 + 5000); 
  }, []);


  const handleMarketChange = (marketId: string) => {
    const newMarket = mockMarkets.find(m => m.id === marketId);
    if (newMarket) {
      setSelectedMarket(newMarket);
      clearSignalData(); // Limpiar señales de IA al cambiar de mercado
    }
  };

  const handleSignalsGenerated = (data: AISignalData) => {
    setAiSignalData(data);
    setIsLoadingAiSignals(false);
    setAiError(null);
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
    console.log("Nueva Orden (Simulada):", orderData);
    // Aquí, en una app real, se llamaría a una API para colocar la orden.
    // Podríamos simular la actualización del balance o historial de trades.
    alert(`Orden ${orderData.type.toUpperCase()} de ${orderData.amount} ${selectedMarket.baseAsset} a ${orderData.price ? orderData.price : 'mercado'} ${orderData.orderType === 'limit' ? '(Límite)' : '(Mercado)'} para ${selectedMarket.name} enviada (simulado).`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem)]"> {/* 4rem es la altura del header */}
          
          {/* Columna Izquierda: Selector de Mercado y Controles de IA */}
          <aside className="col-span-12 md:col-span-3 p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto">
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
                  <BalanceCard balance={totalBalanceUSD} asset="USD (Total Estimado)" />
                </TabsContent>
              </Tabs>
             
              {selectedMarket && (
                 <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{selectedMarket.name}</CardTitle>
                      <CardDescription>Información del Activo (Simulada)</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>Precio Actual: <span className="font-semibold text-primary">${selectedMarket.latestPrice?.toLocaleString() || 'N/A'}</span></p>
                      <p>Cambio 24h: <span className={ (selectedMarket.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>{selectedMarket.change24h?.toFixed(2) || 'N/A'}%</span></p>
                      <p>Volumen 24h (Simulado): ${(Math.random() * 100000000).toLocaleString()}</p>
                    </CardContent>
                  </Card>
              )}
               <Separator className="my-4" />
               <SignalDisplay 
                signalData={aiSignalData} 
                isLoading={isLoadingAiSignals}
                error={aiError}
              />
            </ScrollArea>
          </aside>

          {/* Columna Central: Gráfico y Formulario de Órdenes */}
          <section className="col-span-12 md:col-span-6 p-1 md:p-2 flex flex-col gap-2">
            <div className="flex-grow-[3] min-h-[300px] md:min-h-0">
              <MarketPriceChart
                marketId={selectedMarket.id}
                marketName={selectedMarket.name}
                priceHistory={mockMarketPriceHistory[selectedMarket.id] || []}
              />
            </div>
            <div className="flex-grow-[2] min-h-[280px] md:min-h-0">
              <OrderForm
                market={selectedMarket}
                balanceUSD={totalBalanceUSD || 0} // Simulado
                baseAssetBalance={Math.random() * 10} // Simulado
                onSubmit={handlePlaceOrder}
              />
            </div>
          </section>

          {/* Columna Derecha: Libro de Órdenes (Placeholder) e Historial de Trades */}
          <aside className="col-span-12 md:col-span-3 p-1 md:p-2 flex flex-col gap-2 border-l border-border bg-card/30 overflow-y-auto">
            <ScrollArea className="flex-1 pr-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><PackageSearch className="w-4 h-4 mr-2"/>Libro de Órdenes</CardTitle>
                  <CardDescription className="text-xs">Ofertas de compra y venta.</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  (Libro de órdenes simulado - Próximamente)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center"><LineChart className="w-4 h-4 mr-2"/>Trades del Mercado</CardTitle>
                   <CardDescription className="text-xs">Últimas transacciones en el mercado.</CardDescription>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                   (Trades del mercado simulados - Próximamente)
                </CardContent>
              </Card>
              <Separator className="my-2" />
              <TradeHistoryTable />
            </ScrollArea>
          </aside>
        </div>
      </main>
      {/* El footer podría eliminarse o simplificarse para un look de plataforma */}
       <footer className="py-2 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} CryptoPilot (Simulación). Precios y balances no reales.
      </footer>
    </div>
  );
}
