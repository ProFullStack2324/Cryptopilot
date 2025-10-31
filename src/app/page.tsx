
"use client"; // Marca este componente como un Client Component en Next.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTradingBot, MIN_REQUIRED_HISTORY_FOR_BOT } from '@/hooks/useTradingBot'; 
import { useToast } from '@/hooks/use-toast';
import {
    Market,
    BinanceBalance,
    MarketPriceDataPoint
} from '@/lib/types'; 

// Importaciones de Componentes de Dashboard
import { BotControls } from '@/components/dashboard/bot-controls';
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display';
import { StrategyDashboard } from '@/components/dashboard/strategy-dashboard';
import { StrategyConditionChart } from '@/components/dashboard/strategy-condition-chart';
import { BotStatusFlow } from '@/components/dashboard/bot-status-flow';
import { MarketChart } from '@/components/MarketChart';
import { CHART_COLORS } from '@/components/MarketChart';
import { TradeHistoryTable } from '@/components/dashboard/trade-history-table';
import { SimulatedPerformanceCard } from '@/components/dashboard/simulated-performance-card';
import { Watchlist } from '@/components/dashboard/watchlist';
import { SignalHistoryTable } from '@/components/dashboard/signal-history-table'; // ¡NUEVO!

// Importaciones de UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MOCK_MARKETS: Market[] = [
    {
        id: "BTCUSDT", symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", active: true,
        precision: { amount: 5, price: 2, base: 8, quote: 8 },
        limits: { amount: { min: 0.00001, max: 100 }, price: { min: 0.01, max: 1000000 } , cost: { min: 10 } },
        info: {}, pricePrecision: 2, amountPrecision: 5, latestPrice: null, change24h: null,
    },
    {
        id: "ETHUSDT", symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", active: true,
        precision: { amount: 4, price: 2, base: 8, quote: 8 },
        limits: { amount: { min: 0.0001, max: 1000 }, price: { min: 0.01, max: 10000 } , cost: { min: 10 } },
        info: {}, pricePrecision: 2, amountPrecision: 4, latestPrice: null, change24h: null,
    },
];

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

const parseErrorMessage = (error: string | null): string => {
    if (!error) return "Error desconocido.";
    return error;
};

export default function TradingBotControlPanel() {
    const [selectedMarketId, setSelectedMarketId] = useState<string>("BTCUSDT");
    const [timeframe, setTimeframe] = useState<string>('1m');
    const selectedMarket = useMemo(() => MOCK_MARKETS.find(m => m.id === selectedMarketId) || null, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(true);
    const [balancesError, setBalancesError] = useState<string | null>(null);

    const [operationLogs, setOperationLogs] = useState<any[]>([]);
    const [tradeExecutionLogs, setTradeExecutionLogs] = useState<any[]>([]);
    const [signalLogs, setSignalLogs] = useState<any[]>([]); // ¡NUEVO ESTADO!

    const { toast } = useToast();

    const onBotAction = useCallback((details: any) => {
        const newLog = { ...details, timestamp: Date.now() + Math.random() };
        
        // El Diario del Bot (operationLogs) siempre registra todo
        setOperationLogs(prev => [newLog, ...prev.slice(0, 199)]);
        
        const isInsufficientFunds = details.data?.action === 'hold_insufficient_funds';

        // Registro para el Libro de Órdenes y MongoDB
        if (details.type === 'order_placed' || details.type === 'order_failed' || isInsufficientFunds) {
            let logEntryForExecution = { ...newLog };
            if (isInsufficientFunds) {
                logEntryForExecution.message = `Intento de Compra Fallido: Saldo insuficiente. Requerido: ~$${details.details?.required.toFixed(2)}, Disponible: $${details.details?.available.toFixed(2)}`;
                logEntryForExecution.success = false;
            }
             setTradeExecutionLogs(prev => {
                const updatedLogs = [logEntryForExecution, ...prev.slice(0, 99)];
                (async () => {
                    try {
                        await fetch('/api/logs/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntryForExecution) });
                    } catch (e) { console.error("Failed to save execution log to database", e); }
                })();
                return updatedLogs;
            });
        }
        
        // ¡NUEVO! Registro para el Historial de Señales y MongoDB
        if (details.type === 'strategy_decision' && details.details?.strategyMode) {
             let logEntryForSignal = {
                timestamp: details.timestamp,
                message: `Señal ${details.details.strategyMode.toUpperCase()} detectada (${details.details.buyConditionsCount} condiciones).`,
                details: details.details,
                success: true,
             };
             setSignalLogs(prev => {
                 const updatedLogs = [logEntryForSignal, ...prev.slice(0, 99)];
                (async () => {
                    try {
                        await fetch('/api/signals/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntryForSignal) });
                    } catch (e) { console.error("Failed to save signal log to database", e); }
                })();
                 return updatedLogs;
             });
        }

    }, []);

    const {
        isBotRunning,
        toggleBotStatus,
        isPlacingOrder,
        placeOrderError,
        selectedMarketRules,
        rulesLoading,
        rulesError,
        currentPrice,
        botOpenPosition,
        currentMarketPriceHistory,
        simulatedPosition,
    } = useTradingBot({
        selectedMarket,
        allBinanceBalances: currentBalances,
        onBotAction,
        timeframe,
    });

    useEffect(() => {
        const fetchBalances = async () => {
            setBalancesLoading(true);
            setBalancesError(null);
            try {
                const response = await fetch('/api/binance/balance');
                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.message || `Error HTTP ${response.status}`);
                if (data.balances) {
                    const fetchedBalances: BinanceBalance[] = Object.entries(data.balances).map(([asset, balanceData]: [string, any]) => ({
                        asset: asset,
                        free: balanceData.available,
                        locked: balanceData.onOrder,
                    })).filter(b => b.free > 0 || b.locked > 0);
                    setCurrentBalances(fetchedBalances);
                } else {
                     setCurrentBalances([]);
                }
            } catch (error: any) {
                setBalancesError(error.message);
                toast({ title: "Error al cargar balances", description: error.message, variant: "destructive" });
            } finally {
                setBalancesLoading(false);
            }
        };
        fetchBalances();
        const interval = setInterval(fetchBalances, 60000); 
        return () => clearInterval(interval);
    }, [toast]);

    
    const annotatedHistory = useMemo(() => currentMarketPriceHistory.filter(dp => dp && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)), [currentMarketPriceHistory]);
    const latestDataPointForStrategy = useMemo(() => annotatedHistory.at(-1) || null, [annotatedHistory]);
    const lastStrategyDecision = useMemo(() => operationLogs.find(log => log.type === 'strategy_decision')?.data?.action || 'hold', [operationLogs]);

    const isReadyToStart = !rulesLoading && annotatedHistory.length >= MIN_REQUIRED_HISTORY_FOR_BOT;

    const ScalpingAnalysisDescription = () => {
        if (annotatedHistory.length < MIN_REQUIRED_HISTORY_FOR_BOT) {
            return `Análisis en espera: se necesitan ${MIN_REQUIRED_HISTORY_FOR_BOT} velas para iniciar. Actual: ${annotatedHistory.length}.`;
        }
    
        const latest = latestDataPointForStrategy;
        if (!latest) return "Esperando datos de la última vela...";

        const { rsi, buyConditionsMet } = latest;
    
        if (botOpenPosition) {
            const { entryPrice, takeProfitPrice, stopLossPrice, strategy } = botOpenPosition;
            const strategyName = strategy === 'sniper' ? 'Francotirador' : 'Scalping';
            return `Posición ABIERTA (${strategyName}). Entrada: ${entryPrice.toFixed(2)}. Take Profit: ${takeProfitPrice?.toFixed(2) || 'N/A'}. Stop Loss: ${stopLossPrice?.toFixed(2) || 'N/A'}. Monitoreando para cierre.`;
        }
    
        if (buyConditionsMet && buyConditionsMet >= 2) {
            return `Señal de Francotirador detectada (${buyConditionsMet}/2). El bot intentará abrir una posición con objetivos de ganancia más amplios.`;
        }

        if (buyConditionsMet && buyConditionsMet >= 1) {
            return `Señal de Scalping detectada (${buyConditionsMet}/1). El bot intentará abrir una posición de corto plazo. RSI: ${isValidNumber(rsi) ? rsi.toFixed(1) : 'N/A'}.`;
        }
    
        return "Modo de Caza ACTIVO. Esperando la próxima oportunidad de entrada (RSI en sobreventa, cruce MACD o toque de Banda de Bollinger). El bot actuará según la fuerza de la señal.";
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col">
            <header className="w-full mb-6">
                <Card className="shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle className="text-3xl sm:text-4xl font-bold text-center">CryptoPilot Bot</CardTitle>
                        <CardDescription className="text-center text-muted-foreground">Tu panel de control para trading automatizado.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">Mercado:</span>
                            <Select onValueChange={setSelectedMarketId} value={selectedMarketId || ""}>
                                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                <SelectContent>
                                    {MOCK_MARKETS.map(market => <SelectItem key={market.id} value={market.id}>{market.symbol}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="flex items-center gap-2">
                            <span className="font-semibold">Temporalidad:</span>
                            <Select onValueChange={setTimeframe} value={timeframe}>
                                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tiempo" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1m">1 Minuto</SelectItem>
                                    <SelectItem value="5m">5 Minutos</SelectItem>
                                    <SelectItem value="15m">15 Minutos</SelectItem>
                                    <SelectItem value="1h">1 Hora</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <BotControls isBotRunning={isBotRunning} onToggleBot={toggleBotStatus} isDisabled={!isReadyToStart} />
                    </CardContent>
                    <CardFooter className="flex-col items-center text-xs text-muted-foreground space-y-1">
                        {selectedMarket && <p><strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket.pricePrecision) : 'Cargando...'}</p>}
                        {isPlacingOrder && <p className="text-orange-500 font-semibold">Colocando orden...</p>}
                        {placeOrderError && <p className="text-red-500 font-semibold">Error de Orden: {parseErrorMessage(placeOrderError)}</p>}
                        {rulesError && <p className="text-red-500">Error al cargar reglas: {parseErrorMessage(rulesError)}</p>}
                        {balancesError && <p className="text-red-500">Error al cargar balances: {parseErrorMessage(balancesError)}</p>}
                    </CardFooter>
                </Card>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full">
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Reglas del Mercado ({selectedMarket?.symbol || 'N/A'})</CardTitle></CardHeader>
                        <CardContent>
                            {rulesLoading && <p>Cargando...</p>}
                            {rulesError && <p className="text-red-500">{parseErrorMessage(rulesError)}</p>}
                            {selectedMarketRules ? (
                                <div className="text-sm space-y-1">
                                    <p><strong>Cantidad Mínima:</strong> {isValidNumber(selectedMarketRules.lotSize?.minQty) ? selectedMarketRules.lotSize.minQty : 'N/A'}</p>
                                    <p><strong>Nocional Mínimo:</strong> {isValidNumber(selectedMarketRules.minNotional?.minNotional) ? `${selectedMarketRules.minNotional.minNotional} USDT` : 'N/A'}</p>
                                </div>
                            ) : (!rulesLoading && !rulesError && <p>Selecciona un mercado.</p>)}
                        </CardContent>
                    </Card>
                    <BinanceBalancesDisplay balances={currentBalances.reduce((acc, bal) => ({ ...acc, [bal.asset]: { available: bal.free, onOrder: bal.locked, total: bal.free + bal.locked } }), {})} isLoading={balancesLoading} error={balancesError} />
                    <BotStatusFlow 
                        isBotRunning={isBotRunning}
                        rulesLoading={rulesLoading}
                        balancesLoading={balancesLoading}
                        candleCount={annotatedHistory.length}
                        requiredCandles={MIN_REQUIRED_HISTORY_FOR_BOT}
                        botOpenPosition={botOpenPosition}
                    />
                </div>

                <div className="lg:col-span-1">
                    <Watchlist />
                </div>
                
                {simulatedPosition && (
                    <div className="lg:col-span-4">
                        <SimulatedPerformanceCard
                            simulatedPosition={simulatedPosition}
                            currentPrice={currentPrice}
                            market={selectedMarket}
                        />
                    </div>
                )}
                
                <Card className="lg:col-span-4 shadow-lg rounded-xl">
                    <CardHeader><CardTitle>Gráfica de Mercado</CardTitle></CardHeader>
                    <CardContent>
                        <MarketChart data={annotatedHistory} selectedMarket={selectedMarket} strategyLogs={operationLogs} chartColors={CHART_COLORS} />
                    </CardContent>
                    <CardFooter><p className="text-xs text-muted-foreground"><ScalpingAnalysisDescription /></p></CardFooter>
                </Card>

                 {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-4">
                        <CardHeader><CardTitle>Diagnóstico de Estrategia (Scalping)</CardTitle></CardHeader>
                        <CardContent>
                             <StrategyDashboard 
                                latest={latestDataPointForStrategy} 
                                decision={lastStrategyDecision} 
                                selectedMarket={selectedMarket} 
                                priceHistory={annotatedHistory}
                                botOpenPosition={botOpenPosition}
                                strategyMode="scalping"
                             />
                        </CardContent>
                    </Card>
                )}
                
                <Card className="lg:col-span-4">
                    <CardHeader><CardTitle>Análisis de Condiciones (Scalping vs Francotirador)</CardTitle></CardHeader>
                    <CardContent>
                        <StrategyConditionChart data={annotatedHistory} />
                    </CardContent>
                </Card>

                <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <TradeHistoryTable 
                        logs={tradeExecutionLogs}
                        title="Libro de Órdenes"
                        emptyLogMessage="Esperando la primera acción de compra o venta..."
                        className="md:col-span-1"
                    />
                    <SignalHistoryTable
                        logs={signalLogs}
                        title="Historial de Señales Detectadas"
                        emptyLogMessage="Esperando la primera señal de la estrategia..."
                        className="md:col-span-1"
                    />
                    <TradeHistoryTable 
                        logs={operationLogs}
                        title="Registro de Operaciones (Diario del Bot)"
                        emptyLogMessage="Esperando la primera acción del bot..."
                        className="md:col-span-1"
                    />
                </div>

                {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-4">
                        <CardHeader><CardTitle>Diagnóstico de Estrategia (Análisis Francotirador)</CardTitle></CardHeader>
                        <CardContent>
                             <StrategyDashboard 
                                latest={latestDataPointForStrategy} 
                                decision={lastStrategyDecision} 
                                selectedMarket={selectedMarket} 
                                priceHistory={annotatedHistory}
                                botOpenPosition={botOpenPosition}
                                strategyMode="sniper"
                             />
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
