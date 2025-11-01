
"use client"; // Marca este componente como un Client Component en Next.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTradingBot, MIN_REQUIRED_HISTORY_FOR_BOT } from '@/hooks/useTradingBot'; 
import { useToast } from '@/hooks/use-toast';
import {
    Market,
    BinanceBalance,
    BotActionDetails
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
import { SignalHistoryTable } from '@/components/dashboard/signal-history-table';
import { PerformanceMetricsCard } from '@/components/dashboard/performance-metrics-card';
import { SimulationHistoryTable } from '@/components/dashboard/simulation-history-table';
import { useSimulationHistory } from '@/hooks/useSimulationHistory';


// Importaciones de UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";


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
    if (error.includes("timed out")) return "Error de Timeout: No se pudo conectar con la API de Binance a tiempo. Puede ser un bloqueo geográfico del servidor.";
    return error;
};

export default function TradingBotControlPanel() {
    const [selectedMarketId, setSelectedMarketId] = useState<string>("BTCUSDT");
    const [timeframe, setTimeframe] = useState<string>('1m');
    const selectedMarket = useMemo(() => MOCK_MARKETS.find(m => m.id === selectedMarketId) || null, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(true);
    const [balancesError, setBalancesError] = useState<string | null>(null);

    const [tradeExecutionLogs, setTradeExecutionLogs] = useState<any[]>([]);
    const [signalLogs, setSignalLogs] = useState<any[]>([]);
    const { simulationHistory, isLoading: isSimHistoryLoading, error: simHistoryError, refreshHistory } = useSimulationHistory();


    const { toast } = useToast();

    // ** LA FUNCIÓN CLAVE **
    // Esta función centraliza la recepción de todos los eventos del bot.
    const onBotAction = useCallback((details: BotActionDetails) => {
        const newLog = { ...details, timestamp: Date.now() };

        // Filtra eventos para la tabla "Libro de Órdenes"
        if (details.type === 'order_placed' || details.type === 'order_failed' || details.type === 'hold_insufficient_funds') {
            let logEntryForExecution = { ...newLog, message: details.message || 'Acción de orden' };
            if (details.type === 'hold_insufficient_funds') {
                logEntryForExecution.message = `Intento de Compra Fallido: Saldo insuficiente. Requerido: ~$${(details.details?.required || 0).toFixed(2)}, Disponible: $${(details.details?.available || 0).toFixed(2)}`;
                logEntryForExecution.success = false;
            }
             setTradeExecutionLogs(prev => [logEntryForExecution, ...prev.slice(0, 99)]);
            // Guardar en la base de datos
            if(details.type === 'order_placed' || details.type === 'order_failed') {
                fetch('/api/logs/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntryForExecution) })
                    .catch(e => console.error("Failed to save execution log to database", e));
            }
        }
        
        // Filtra eventos para la tabla "Historial de Señales Detectadas"
        if (details.type === 'strategy_decision' && details.details?.strategyMode) {
             let logEntryForSignal = {
                ...newLog,
                message: `Señal ${details.data.action.toUpperCase()} detectada (${details.details.buyConditionsCount} condiciones). Modo: ${details.details.strategyMode}`,
                success: true,
             };
             setSignalLogs(prev => [logEntryForSignal, ...prev.slice(0, 99)]);
             // Guardar en la base de datos
            fetch('/api/signals/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntryForSignal) })
                .catch(e => console.error("Failed to save signal log to database", e));
        }

        // Si la simulación se cierra, refrescamos el historial
        if (details.message?.includes("Simulación finalizada")) {
            refreshHistory();
        }

    }, [refreshHistory]);


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
        onBotAction, // Pasamos la función centralizada al hook
        timeframe,
    });
    
    // Carga inicial de logs desde la BD
    useEffect(() => {
        const fetchInitialLogs = async () => {
            try {
                // Endpoint para logs de trades
                // const tradeLogsRes = await fetch('/api/logs/history?type=trade&limit=50').then(res => res.json());
                // if (tradeLogsRes.success) setTradeExecutionLogs(tradeLogsRes.logs.reverse()); // Asumiendo que vienen del más antiguo al más nuevo

                // Endpoint para logs de señales
                // const signalLogsRes = await fetch('/api/signals/history?limit=50').then(res => res.json());
                // if (signalLogsRes.success) setSignalLogs(signalLogsRes.logs.reverse());
                
                // El historial de simulaciones ya se carga a través de su propio hook
                refreshHistory();

            } catch (e) {
                console.error("Error fetching initial logs", e);
                toast({
                    title: "Error al Cargar Historial",
                    description: "No se pudieron cargar los registros históricos desde la base de datos.",
                    variant: "destructive"
                });
            }
        };
        fetchInitialLogs();
    }, [refreshHistory, toast]);

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
            } finally {
                setBalancesLoading(false);
            }
        };
        fetchBalances();
        const interval = setInterval(fetchBalances, 60000); 
        return () => clearInterval(interval);
    }, []);

    
    const annotatedHistory = useMemo(() => currentMarketPriceHistory.filter(dp => dp && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)), [currentMarketPriceHistory]);
    const latestDataPointForStrategy = useMemo(() => annotatedHistory.at(-1) || null, [annotatedHistory]);
    const lastStrategyDecision = useMemo(() => signalLogs.find(log => log.type === 'strategy_decision')?.data?.action || 'hold', [signalLogs]);

    const isReadyToStart = !rulesLoading && annotatedHistory.length >= MIN_REQUIRED_HISTORY_FOR_BOT;

    const ScalpingAnalysisDescription = () => {
        if (rulesError) {
            return `Modo Simulado Activo: No se pudo conectar a Binance. El bot está operando con datos de mercado simulados.`;
        }
        if (annotatedHistory.length < MIN_REQUIRED_HISTORY_FOR_BOT) {
            return `Análisis en espera: se necesitan ${MIN_REQUIRED_HISTORY_FOR_BOT} velas para iniciar. Actual: ${annotatedHistory.length}.`;
        }
        const latest = latestDataPointForStrategy;
        if (!latest) return "Esperando datos de la última vela...";
    
        if (botOpenPosition) {
            const { entryPrice, takeProfitPrice, stopLossPrice, strategy } = botOpenPosition;
            const strategyName = strategy === 'sniper' ? 'Francotirador' : 'Scalping';
            return `Posición ABIERTA (${strategyName}). Entrada: ${entryPrice.toFixed(2)}. Take Profit: ${takeProfitPrice?.toFixed(2) || 'N/A'}. Stop Loss: ${stopLossPrice?.toFixed(2) || 'N/A'}. Monitoreando para cierre.`;
        }
        
        if (simulatedPosition) {
            return `Simulación ACTIVA. Monitoreando PnL de oportunidad perdida.`;
        }
    
        const { buyConditionsMet } = latest;
        if ((buyConditionsMet || 0) >= 2) {
            return `Modo de Caza ACTIVO. Señal de Francotirador detectada (${buyConditionsMet}/3). Esperando confirmación para actuar.`;
        }
        if ((buyConditionsMet || 0) >= 1) {
            return `Modo de Caza ACTIVO. Señal de Scalping detectada (${buyConditionsMet}/3). Esperando confirmación para actuar.`;
        }
    
        return "Modo de Caza ACTIVO. Esperando la próxima oportunidad de entrada (RSI en sobreventa, cruce MACD o toque de Banda de Bollinger).";
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
                    {(isPlacingOrder || placeOrderError || rulesError || balancesError) && (
                        <CardFooter>
                            <div className="text-xs text-muted-foreground w-full">
                                {isPlacingOrder && <p className="text-orange-500 font-semibold">Colocando orden...</p>}
                                {placeOrderError && <Alert variant="destructive" className="mt-2"><Terminal className="h-4 w-4" /><AlertTitle>Error de Orden</AlertTitle><AlertDescription>{parseErrorMessage(placeOrderError)}</AlertDescription></Alert>}
                                {rulesError && <Alert variant="destructive" className="mt-2"><Terminal className="h-4 w-4" /><AlertTitle>Error de Conexión</AlertTitle><AlertDescription>{parseErrorMessage(rulesError)}</AlertDescription></Alert>}
                                {balancesError && <Alert variant="destructive" className="mt-2"><Terminal className="h-4 w-4" /><AlertTitle>Error de Balances</AlertTitle><AlertDescription>{parseErrorMessage(balancesError)}</AlertDescription></Alert>}
                            </div>
                        </CardFooter>
                    )}
                </Card>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full">
                 <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <BinanceBalancesDisplay balances={currentBalances.reduce((acc, bal) => ({ ...acc, [bal.asset]: { available: bal.free, onOrder: bal.locked, total: bal.free + bal.locked } }), {})} isLoading={balancesLoading} error={balancesError} />
                    </div>
                    <div className="md:col-span-2">
                        <PerformanceMetricsCard />
                    </div>
                </div>

                <div className="lg:col-span-1 row-start-1 lg:row-start-auto">
                     <BotStatusFlow 
                        isBotRunning={isBotRunning}
                        rulesLoading={rulesLoading}
                        balancesLoading={balancesLoading}
                        candleCount={annotatedHistory.length}
                        requiredCandles={MIN_REQUIRED_HISTORY_FOR_BOT}
                        botOpenPosition={botOpenPosition}
                     />
                </div>
                
                {(simulatedPosition || botOpenPosition) && (
                    <div className="lg:col-span-4">
                        {simulatedPosition && (
                            <SimulatedPerformanceCard
                                simulatedPosition={simulatedPosition}
                                currentPrice={currentPrice}
                                market={selectedMarket}
                            />
                        )}
                        {/* Aquí podrías poner un Card para la posición real si lo deseas */}
                    </div>
                )}
                
                <Card className="lg:col-span-4 shadow-lg rounded-xl">
                    <CardHeader><CardTitle>Gráfica de Mercado ({selectedMarket?.symbol || 'N/A'})</CardTitle></CardHeader>
                    <CardContent>
                        <MarketChart data={annotatedHistory} selectedMarket={selectedMarket} strategyLogs={signalLogs} chartColors={CHART_COLORS} />
                    </CardContent>
                    <CardFooter><p className="text-xs text-muted-foreground"><ScalpingAnalysisDescription /></p></CardFooter>
                </Card>

                 {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-4">
                        <CardHeader><CardTitle>Diagnóstico de Estrategia</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <StrategyDashboard 
                                latest={latestDataPointForStrategy} 
                                decision={lastStrategyDecision} 
                                selectedMarket={selectedMarket} 
                                priceHistory={annotatedHistory}
                                botOpenPosition={botOpenPosition}
                                strategyMode="scalping"
                             />
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
                
                <Card className="lg:col-span-4">
                    <CardHeader><CardTitle>Análisis de Condiciones de Estrategia</CardTitle></CardHeader>
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
                    <SimulationHistoryTable 
                        logs={simulationHistory}
                        isLoading={isSimHistoryLoading}
                        error={simHistoryError}
                        title="Historial de Simulaciones"
                        emptyLogMessage="No hay simulaciones completadas."
                        className="md:col-span-1"
                    />
                </div>

                <div className="lg:col-span-4">
                    <Watchlist />
                </div>
            </main>
        </div>
    );
}
