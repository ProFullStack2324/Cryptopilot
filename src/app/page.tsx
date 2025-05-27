
"use client";

import { useState, useEffect } from "react";
import type { AISignalData, Market, OrderFormData, Trade, MarketPriceDataPoint, SignalEvent, SimulatedPosition, ParsedSignals, SignalItem } from "@/lib/types";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, PackageSearch, Info, TrendingUp, TrendingDown, WalletCards, BotIcon, BookOpen, LandmarkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNAL_EVENTS_ON_CHART = 5;
const AI_TRADE_CONFIDENCE_THRESHOLD = 0.7; 

// Helper to validate individual signal items
const isValidSignalItem = (item: any): item is SignalItem => {
  return typeof item === 'object' && item !== null &&
         typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
         typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
};

// Componente para mostrar P&L de posición simulada
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

  if (position.type === 'buy') {
    pnl = (currentPrice - position.entryPrice) * position.amount;
  } else { // 'sell'
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

  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false); 
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); 

  const toggleLeftSidebar = () => setIsLeftSidebarOpen(!isLeftSidebarOpen);
  const toggleRightSidebar = () => setIsRightSidebarOpen(!isRightSidebarOpen);


  useEffect(() => {
    const initialQuote = Math.random() * 25000 + 5000; 
    setAvailableQuoteBalance(initialQuote);
    const defaultMarketBaseBalance = Math.random() * (mockMarkets[0].baseAsset === 'BTC' ? 0.5 : 10) + 0.1;
    setCurrentBaseAssetBalance(defaultMarketBaseBalance);
  }, []);

  useEffect(() => {
    setCurrentMarketPriceHistory(mockMarketPriceHistory[selectedMarket.id] || []);
    setSignalEvents([]); 
    setCurrentSimulatedPosition(null); 
  }, [selectedMarket]);


  const handleMarketChange = (marketId: string) => {
    const newMarket = mockMarkets.find(m => m.id === marketId);
    if (newMarket) {
      setSelectedMarket(newMarket);
      clearSignalData(); 
      const newBaseBalance = Math.random() * (newMarket.baseAsset === 'BTC' ? 0.2 : 5) + (newMarket.baseAsset === 'BTC' ? 0.01 : 0.5);
      setCurrentBaseAssetBalance(newBaseBalance);
    }
  };

  const handlePlaceOrder = (orderData: OrderFormData, isAISimulated: boolean = false): boolean => {
    const priceToUse = orderData.orderType === 'limit' && orderData.price ? orderData.price : (currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price : selectedMarket.latestPrice || 0);
    
    if (priceToUse <= 0) {
      if (!isAISimulated) {
        toast({ title: "Error de Precio", description: "No se pudo determinar un precio válido para la orden.", variant: "destructive" });
      }
      return false;
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
      status: 'Completado',
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
          title: isAISimulated ? "IA Simuló Compra Exitosa" : "Orden de Compra (Simulada) Exitosa",
          description: `Comprados ${orderData.amount.toFixed(6)} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
        return true;
      } else {
        if (!isAISimulated) { 
          toast({ title: "Fondos Insuficientes (Simulado)", description: `No tienes suficiente ${selectedMarket.quoteAsset} para comprar ${orderData.amount} ${selectedMarket.baseAsset}.`, variant: "destructive" });
        }
        return false;
      }
    } else { 
      if (currentBaseAssetBalance >= orderData.amount) {
        setCurrentBaseAssetBalance(currentBaseAssetBalance - orderData.amount);
        setAvailableQuoteBalance((availableQuoteBalance || 0) + totalCostOrProceeds);
        setTradeHistory(prev => [newTrade, ...prev]);
        setCurrentSimulatedPosition({
            marketId: selectedMarket.id,
            entryPrice: priceToUse,
            amount: orderData.amount,
            type: 'sell',
            timestamp: Math.floor(Date.now() / 1000)
        });
        toast({
          title: isAISimulated ? "IA Simuló Venta Exitosa" : "Orden de Venta (Simulada) Exitosa",
          description: `Vendidos ${orderData.amount.toFixed(6)} ${selectedMarket.baseAsset} a $${priceToUse.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: selectedMarket.baseAsset === 'BTC' || selectedMarket.baseAsset === 'ETH' ? 2 : 5})}`,
          variant: "default"
        });
        return true;
      } else {
         if (!isAISimulated) {
          toast({ title: "Fondos Insuficientes (Simulado)", description: `No tienes suficiente ${selectedMarket.baseAsset} para vender ${orderData.amount}.`, variant: "destructive" });
        }
        return false;
      }
    }
  };

  const handleSignalsGenerated = (data: AISignalData) => {
    setAiSignalData(data);
    setAiError(null); // Clear previous errors if generation is successful this time

    let parsedSignalsArray: ParsedSignals | null = null;
    try {
      const rawParsed = JSON.parse(data.signals);
      if (Array.isArray(rawParsed) && rawParsed.every(isValidSignalItem)) {
        parsedSignalsArray = rawParsed as ParsedSignals;
      } else {
        throw new Error("Los datos de señales de IA no son un array de objetos de señal válidos.");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Formato de señales JSON inesperado.";
      console.error("Error al analizar señales JSON en page.tsx:", errorMsg, "Datos recibidos:", data.signals);
      setAiError(`Error de formato en señales de IA: ${errorMsg}. Revise la consola para más detalles.`);
      setAiSignalData(prev => prev ? {...prev, signals: "[]"} : {signals: "[]", explanation: "Error al procesar señales."}); // Clear signals for display
      toast({
        title: "Error de Formato de Señal IA",
        description: errorMsg,
        variant: "destructive",
      });
      return; // Stop further processing if parsing fails
    }

    if (parsedSignalsArray && currentMarketPriceHistory.length > 0) {
      const latestPricePoint = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
      if (!latestPricePoint) return;

      const newEvents: SignalEvent[] = parsedSignalsArray
        .filter(s => s.signal === 'BUY' || s.signal === 'SELL')
        .map(s => ({
          timestamp: latestPricePoint.timestamp,
          price: latestPricePoint.price,
          type: s.signal as 'BUY' | 'SELL',
          confidence: s.confidence,
        }));

      setSignalEvents(prevEvents => [...prevEvents, ...newEvents].slice(-MAX_SIGNAL_EVENTS_ON_CHART));

      // Simular ejecución de trade por IA
      for (const signal of parsedSignalsArray) {
        if ((signal.signal === 'BUY' || signal.signal === 'SELL') && signal.confidence >= AI_TRADE_CONFIDENCE_THRESHOLD) {
          let tradeAmount = 0.01; 
          if (selectedMarket.baseAsset === 'BTC') tradeAmount = 0.0005;
          else if (selectedMarket.baseAsset === 'ETH') tradeAmount = 0.005;
          else if (selectedMarket.quoteAsset === 'USD' && latestPricePoint.price > 0) {
              const dollarAmountToInvest = Math.random() * 40 + 10;
              tradeAmount = dollarAmountToInvest / latestPricePoint.price;
          }
          
          tradeAmount = parseFloat(tradeAmount.toFixed(6));
          if (tradeAmount <=0) continue;

          const simulatedOrder: OrderFormData = {
            type: signal.signal === 'BUY' ? 'buy' : 'sell',
            marketId: selectedMarket.id,
            amount: tradeAmount,
            orderType: 'market',
            price: latestPricePoint.price 
          };
          const success = handlePlaceOrder(simulatedOrder, true); 
          if (success) {
               console.log(`IA simuló un trade ${signal.signal} de ${tradeAmount} ${selectedMarket.baseAsset} con confianza ${signal.confidence}`);
          }
          break; 
        }
      }
    } else if (parsedSignalsArray === null) {
        // This case is now handled by the try-catch block if JSON.parse fails or validation fails
    }
  };


  const handleGenerationError = (errorMsg: string) => {
    setAiSignalData(null);
    setAiError(errorMsg); // Set the error message to be displayed by SignalDisplay
    toast({
      title: "Error en Generación de Señales IA",
      description: errorMsg,
      variant: "destructive",
    });
  };
  

  const clearSignalData = () => {
    setAiSignalData(null);
    setAiError(null);
  }

  const generateSignalsActionWrapper = async (input: any) => {
    setIsLoadingAiSignals(true);
    setAiError(null); 
    setAiSignalData(null); // Clear previous data before new request
    try {
      const result = await handleGenerateSignalsAction(input);
      // Validate structure of result before processing
      if (typeof result.signals !== 'string' || typeof result.explanation !== 'string') {
        throw new Error("La respuesta de la IA no tiene la estructura esperada (signals/explanation).");
      }
      handleSignalsGenerated(result);
      setIsLoadingAiSignals(false);
      return result; 
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido al generar señales.";
        console.error("Error en generateSignalsActionWrapper:", errorMessage, error);
        handleGenerationError(errorMessage);
        setIsLoadingAiSignals(false); // Ensure loading state is reset on error
        throw error; 
    }
  };
  
  const latestPriceForPnl = currentMarketPriceHistory.length > 0 ? currentMarketPriceHistory[currentMarketPriceHistory.length - 1].price : undefined;

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
      />
      <main className="flex-1">
        <div className="grid grid-cols-12 gap-0 md:gap-2 h-[calc(100vh-4rem)]">

          <aside className={`col-span-12 ${isLeftSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-1 md:p-2 flex flex-col gap-2 border-r border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
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

          <section className={`col-span-12 ${centralColSpan} p-1 md:p-2 flex flex-col gap-2 transition-all duration-300 ease-in-out`}>
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
                onSubmit={(orderData) => handlePlaceOrder(orderData, false)} 
                currentPrice={latestPriceForPnl}
              />
            </div>
          </section>

          <aside className={`col-span-12 ${isRightSidebarOpen ? 'md:col-span-3' : 'md:hidden'} p-2 flex flex-col gap-2 border-l border-border bg-card/30 overflow-y-auto transition-all duration-300 ease-in-out`}>
            <ScrollArea className="flex-1 pr-2">
              <MarketSelector
                markets={mockMarkets}
                selectedMarketId={selectedMarket.id}
                onMarketChange={handleMarketChange}
              />
              <Separator className="my-4" />
              <Tabs defaultValue="ai-controls" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-2">
                  <TabsTrigger value="ai-controls"><BotIcon className="w-4 h-4 mr-1" />Control IA</TabsTrigger>
                  <TabsTrigger value="balance"><LandmarkIcon className="w-4 h-4 mr-1"/>Info. Activo</TabsTrigger>
                  <TabsTrigger value="metric-guide"><BookOpen className="w-4 h-4 mr-1"/>Guía</TabsTrigger>
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
                <TabsContent value="metric-guide">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center"><BookOpen className="w-4 h-4 mr-2 text-primary"/>Guía de Métricas del Gráfico</CardTitle>
                      <CardDescription className="text-xs">Explicación de los indicadores visualizados.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="price">
                          <AccordionTrigger>Precio (Línea Principal)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Esta línea (generalmente azul o la más destacada) representa el <strong>precio de cotización más reciente</strong> del activo en el mercado seleccionado (ej. BTC/USD).</p>
                            <p className="mb-2"><strong>Para qué sirve:</strong> Es la información fundamental. Muestra el valor al que se está comprando y vendiendo el activo en un momento dado. Su movimiento refleja la oferta y la demanda.</p>
                            <p>En esta simulación, el precio se actualiza cada pocos segundos para imitar el dinamismo de un mercado real.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma10">
                          <AccordionTrigger>SMA 10 (Media Móvil Simple de 10 períodos)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">La SMA 10 calcula el <strong>precio promedio de los últimos 10 puntos de datos</strong> del gráfico. En nuestro gráfico, cada punto de dato representa un intervalo corto (segundos o minutos, según la simulación actual).</p>
                            <p className="mb-2"><strong>Para qué sirve:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><strong>Tendencia a Corto Plazo:</strong> Al ser una media de corto plazo, reacciona rápidamente a los cambios recientes en el precio, ayudando a identificar la dirección inmediata del mercado.</li>
                              <li><strong>Suavizar Ruido:</strong> Ayuda a filtrar fluctuaciones muy pequeñas y momentáneas del precio, ofreciendo una visión un poco más clara de la tendencia subyacente.</li>
                              <li><strong>Posibles Señales:</strong> El cruce del precio por encima o por debajo de la SMA 10 puede ser usado por algunos traders como una indicación temprana de un cambio de dirección.</li>
                            </ul>
                             <p className="mt-2"><strong>Ejemplo práctico:</strong> Si el precio cruza hacia arriba la SMA 10 después de haber estado por debajo, podría indicar una fortaleza compradora emergente. Si cruza hacia abajo, debilidad.</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma20">
                          <AccordionTrigger>SMA 20 (Media Móvil Simple de 20 períodos)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">La SMA 20 calcula el <strong>precio promedio de los últimos 20 puntos de datos</strong> del gráfico.</p>
                            <p className="mb-2"><strong>Para qué sirve:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><strong>Tendencia a Mediano Plazo (Relativo al Gráfico):</strong> Es una media de plazo un poco más largo que la SMA 10. Proporciona una visión de la tendencia más suavizada y menos sensible a movimientos bruscos y cortos.</li>
                              <li><strong>Confirmación de Tendencia:</strong> Puede usarse para confirmar la dirección de la tendencia sugerida por medias más cortas o por el propio precio. Por ejemplo, si el precio y la SMA 10 están por encima de la SMA 20, refuerza la idea de una tendencia alcista.</li>
                              <li><strong>Niveles Dinámicos de Soporte/Resistencia:</strong> Al igual que otras SMAs, puede actuar como un nivel de soporte (si el precio está por encima y rebota en la SMA 20) o resistencia (si el precio está por debajo y le cuesta superar la SMA 20).</li>
                            </ul>
                            <p className="mt-2"><strong>Ejemplo práctico:</strong> En una tendencia alcista, el precio podría retroceder hasta la SMA 20 y encontrar "soporte" allí antes de continuar subiendo. En una tendencia bajista, podría subir hasta la SMA 20 y encontrar "resistencia".</p>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="sma-general">
                          <AccordionTrigger>Uso General de Medias Móviles (SMAs)</AccordionTrigger>
                          <AccordionContent>
                            <p className="mb-2">Las Medias Móviles Simples (SMAs) son herramientas populares en el análisis técnico porque ayudan a visualizar la dirección de la tendencia de un activo y a generar posibles señales de trading.</p>
                            <p className="mb-2"><strong>Principales Usos:</strong></p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><strong>Identificación de Tendencia:</strong> Si el precio se mantiene consistentemente por encima de una SMA, sugiere una tendencia alcista. Si se mantiene por debajo, una tendencia bajista. La inclinación de la SMA también da pistas sobre la fortaleza de la tendencia.</li>
                              <li><strong>Cruces de Medias (Crossovers):</strong>
                                <ul className="list-circle pl-5 mt-1 space-y-1">
                                  <li><strong>Cruce Dorado (Golden Cross):</strong> Ocurre cuando una SMA de corto plazo (ej. SMA 10 en nuestro caso) cruza por encima de una SMA de más largo plazo (ej. SMA 20). A menudo se interpreta como una señal alcista (potencial compra).</li>
                                  <li><strong>Cruce de la Muerte (Death Cross):</strong> Ocurre cuando una SMA de corto plazo cruza por debajo de una SMA de más largo plazo. A menudo se interpreta como una señal bajista (potencial venta).</li>
                                </ul>
                              </li>
                              <li><strong>Soporte y Resistencia Dinámicos:</strong> Las SMAs pueden actuar como niveles donde el precio puede encontrar soporte (en una tendencia alcista) o resistencia (en una tendencia bajista). Un rebote en una SMA puede ser una señal de continuación de tendencia.</li>
                            </ul>
                            <p className="mt-2"><strong>Importante:</strong> Las SMAs son indicadores rezagados (se basan en precios pasados) y funcionan mejor en mercados con tendencia. En mercados laterales o muy volátiles, pueden generar señales falsas. No existe una configuración única que funcione para todos los activos o condiciones de mercado. Los traders suelen combinar SMAs con otros indicadores y análisis para tomar decisiones.</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
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

    
