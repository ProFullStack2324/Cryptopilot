
// src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTradingBot } from '@/hooks/useTradingBot';
import { useToast } from "@/hooks/use-toast";
import { 
    Market, 
    MarketPriceDataPoint, 
    BinanceBalance,
    BotActionDetails
} from '@/lib/types';

import { Toaster } from "@/components/ui/toaster";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BotControls } from '@/components/dashboard/bot-controls';
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import FinancialChart from '@/components/FinancialChart';
import { StrategyDashboard } from '@/components/dashboard/strategy-dashboard';
import { StrategyConditionChart } from '@/components/dashboard/strategy-condition-chart';

// Helper para validar números
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Componente para la selección de mercado
function MarketSelector({ markets, onMarketSelect, selectedMarketId, isLoading }: { markets: Market[], onMarketSelect: (marketId: string) => void, selectedMarketId: string | null, isLoading: boolean }) {
  if (isLoading) return <p>Cargando mercados...</p>;
  return (
    <Select onValueChange={onMarketSelect} value={selectedMarketId || ''}>
      <SelectTrigger className="w-full md:w-[280px]">
        <SelectValue placeholder="Seleccionar Mercado" />
      </SelectTrigger>
      <SelectContent>
        {markets.map((market) => (
          <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Componente de Análisis Combinado
const CombinedAnalysisDescription = ({ latest, prev, decision, botOpenPosition, priceHistory, selectedMarket, allBinanceBalances }: { 
    latest: MarketPriceDataPoint | null,
    prev: MarketPriceDataPoint | null,
    decision: string,
    botOpenPosition: any,
    priceHistory: MarketPriceDataPoint[],
    selectedMarket: Market | null,
    allBinanceBalances: any[]
}) => {
    if (!latest || !prev || !selectedMarket) return <p className="text-sm text-muted-foreground">Análisis no disponible. Esperando datos...</p>;

    const { rsi, macdHistogram, closePrice, upperBollingerBand, lowerBollingerBand, sma10, sma20, sma50 } = latest;
    const prevMacdHistogram = prev.macdHistogram;

    // --- Definición de condiciones ---
    const buyPriceCondition = isValidNumber(closePrice) && isValidNumber(lowerBollingerBand) && closePrice <= lowerBollingerBand;
    const buyRsiCondition = isValidNumber(rsi) && rsi <= 35;
    const buyMacdCondition = isValidNumber(macdHistogram) && isValidNumber(prevMacdHistogram) && macdHistogram > 0 && prevMacdHistogram <= 0;
    
    const sellPriceCondition = isValidNumber(closePrice) && isValidNumber(upperBollingerBand) && closePrice >= upperBollingerBand;
    const sellRsiCondition = isValidNumber(rsi) && rsi >= 65;

    // --- Conteo y Lógica de Decisión (simulada para descripción) ---
    const buyConditionsMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition].filter(Boolean).length;
    const sellConditionsMet = [sellPriceCondition, sellRsiCondition].filter(Boolean).length;
    
    let analysisText: React.ReactNode;

    const baseAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.baseAsset)?.free || 0;

    if (botOpenPosition) {
        analysisText = (
            <span>
                Posición de COMPRA abierta. Buscando señal de VENTA.
                <br />
                {sellConditionsMet > 0 ? 
                    `Se cumplen ${sellConditionsMet}/1 condiciones de venta. ` :
                    'No se cumplen condiciones de venta. '
                }
                {sellPriceCondition ? '✅ Precio en BB sup. ' : '❌ Precio en BB sup. '}
                {sellRsiCondition ? '✅ RSI Sobrecompra. ' : '❌ RSI Sobrecompra. '}
            </span>
        );
    } else { // No hay posición abierta
        if (buyConditionsMet >= 2) {
             analysisText = (
                <span>
                    Señal de COMPRA fuerte detectada.
                    <br />
                    Cumplidas {buyConditionsMet}/2 condiciones: 
                    {buyPriceCondition && ' [✅ Precio en BB inf.]'}
                    {buyRsiCondition && ' [✅ RSI Sobreventa]'}
                    {buyMacdCondition && ' [✅ Cruce MACD]'}
                </span>
            );
        } else {
             analysisText = (
                <span>
                    Esperando señal de COMPRA.
                    <br />
                    Faltan {2 - buyConditionsMet} condiciones.
                    {!buyPriceCondition && ' [❌ Precio en BB inf.]'}
                    {!buyRsiCondition && ' [❌ RSI Sobreventa]'}
                    {!buyMacdCondition && ' [❌ Cruce MACD]'}
                </span>
            );
        }
    }

    const priceChange = priceHistory.length > 1 ? closePrice - priceHistory[0].closePrice : 0;
    const trendDirection = sma10 > sma50 ? 'Alcista' : 'Bajista';
    const trendStrength = Math.abs(sma10 - sma50) / sma50 > 0.01 ? 'Fuerte' : 'Débil';
    const volatility = upperBollingerBand - lowerBollingerBand;
    const volatilityState = (volatility / closePrice) > 0.05 ? 'Alta Volatilidad' : 'Compresión';

    return (
        <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Decisión del Bot:</span> <span className={`font-bold ${decision === 'buy' ? 'text-green-500' : decision === 'sell' ? 'text-red-500' : 'text-amber-400'}`}>{decision.toUpperCase()}</span></p>
            <p><span className="font-semibold">Resumen Lógico:</span> {analysisText}</p>
            <p><span className="font-semibold">Tendencia ({trendStrength}):</span> {trendDirection}</p>
            <p><span className="font-semibold">Volatilidad:</span> {volatilityState}</p>
            <p><span className="font-semibold">Momentum:</span> {rsi > 70 ? 'Sobrecompra' : rsi < 30 ? 'Sobreventa' : 'Neutral'}</p>
        </div>
    );
};


export default function DashboardPage() {
    const [allBinanceBalances, setAllBinanceBalances] = useState<BinanceBalance[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<string>('BTCUSDT');
    const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
    const [botActionsLog, setBotActionsLog] = useState<BotActionDetails[]>([]);

    const selectedMarket = useMemo(() => availableMarkets.find(m => m.id === selectedMarketId) || null, [availableMarkets, selectedMarketId]);

    const { toast } = useToast();

    const handleBotAction = useCallback((details: BotActionDetails) => {
        setBotActionsLog(prev => [details, ...prev].slice(0, 100)); // Mantener un log de las últimas 100 acciones
    }, []);

    const { 
        isBotRunning, 
        toggleBotStatus, 
        botOpenPosition,
        currentPrice,
        currentMarketPriceHistory
    } = useTradingBot({ selectedMarket, allBinanceBalances, onBotAction: handleBotAction });

    // Cargar mercados disponibles al montar
    useEffect(() => {
        const fetchMarkets = async () => {
            setIsLoadingMarkets(true);
            try {
                const response = await fetch('/api/binance/symbols', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    setAvailableMarkets(data.symbols);
                } else {
                    toast({ title: "Error", description: "No se pudieron cargar los mercados.", variant: "destructive" });
                }
            } catch (error) {
                toast({ title: "Error de Red", description: "No se pudieron cargar los mercados.", variant: "destructive" });
            } finally {
                setIsLoadingMarkets(false);
            }
        };
        fetchMarkets();
    }, [toast]);
    
    // Cargar balances al montar
    useEffect(() => {
        const fetchBalances = async () => {
            try {
                const res = await fetch('/api/binance/balance');
                const data = await res.json();
                if (data.success) {
                    const formattedBalances: BinanceBalance[] = Object.entries(data.balances).map(([asset, details]) => ({
                        asset,
                        free: (details as any).available,
                        locked: (details as any).onOrder
                    }));
                    setAllBinanceBalances(formattedBalances);
                }
            } catch (error) {
                console.error("Error fetching balances:", error);
            }
        };
        fetchBalances();
        const interval = setInterval(fetchBalances, 30000); // Actualizar cada 30s
        return () => clearInterval(interval);
    }, []);

    const portfolioValue = useMemo(() => {
        const usdtBalance = allBinanceBalances.find(b => b.asset === 'USDT')?.free || 0;
        const btcBalance = allBinanceBalances.find(b => b.asset === 'BTC')?.free || 0;
        const btcPrice = availableMarkets.find(m => m.symbol === 'BTC/USDT')?.latestPrice || currentPrice || 0;
        return usdtBalance + (btcBalance * btcPrice);
    }, [allBinanceBalances, availableMarkets, currentPrice]);

    const latestDecision = useMemo(() => botActionsLog.find(a => a.type === 'strategy_decision')?.data?.action || 'hold', [botActionsLog]);
    
    const displayBalances = useMemo(() => {
        return allBinanceBalances.reduce((acc, b) => {
            if (b.free > 0 || b.locked > 0) {
                acc[b.asset] = { available: b.free, onOrder: b.locked, total: b.free + b.locked };
            }
            return acc;
        }, {} as Record<string, { available: number; onOrder: number; total: number; }>);
    }, [allBinanceBalances]);

    return (
        <>
            <main className="flex min-h-screen flex-col bg-background text-foreground">
                <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="container flex h-14 items-center">
                        <div className="mr-4 hidden md:flex">
                           <h1 className="text-xl font-bold">CryptoPilot</h1>
                        </div>
                        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                            <div className="w-full flex-1 md:w-auto md:flex-none">
                                <MarketSelector 
                                    markets={availableMarkets} 
                                    onMarketSelect={setSelectedMarketId} 
                                    selectedMarketId={selectedMarketId}
                                    isLoading={isLoadingMarkets}
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="container flex-1 items-start md:grid md:grid-cols-[260px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 py-6">
                    {/* Columna Izquierda (Controles y Balances) */}
                    <aside className="sticky top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
                        <div className="relative h-full overflow-y-auto p-2 space-y-4">
                            <BotControls isBotRunning={isBotRunning} onToggleBot={toggleBotStatus} />
                            <BinanceBalancesDisplay balances={displayBalances} isLoading={false} error={null} />
                            <PerformanceChart portfolioValue={portfolioValue} />
                        </div>
                    </aside>

                    {/* Contenido Principal (Gráficos y Diagnóstico) */}
                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Gráfico de Mercado: {selectedMarket?.name || 'N/A'}</CardTitle>
                                <CardDescription>Velas de 1 minuto con indicadores técnicos.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FinancialChart data={currentMarketPriceHistory} />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Diagnóstico de Estrategia</CardTitle>
                                <CardDescription>Análisis de las condiciones para la toma de decisiones del bot.</CardDescription>
                            </CardHeader>
                             <CardContent>
                                <StrategyDashboard 
                                    latest={currentMarketPriceHistory.at(-1) || null}
                                    decision={latestDecision}
                                    selectedMarket={selectedMarket}
                                    priceHistory={currentMarketPriceHistory}
                                />
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Condiciones de Estrategia Acumuladas</CardTitle>
                                <CardDescription>Visualiza cuántas condiciones de compra (arriba) o venta (abajo) se cumplen a lo largo del tiempo.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <StrategyConditionChart data={currentMarketPriceHistory} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
            <Toaster />
        </>
    );
}
