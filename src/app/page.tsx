"use client"; // Marca este componente como un Client Component en Next.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTradingBot } from '@/hooks/useTradingBot'; 
import { useToast } from '@/hooks/use-toast';
import {
    Market,
    BinanceBalance,
    MarketPriceDataPoint
} from '@/lib/types'; 

// Importaciones de Componentes de Dashboard
import { BotControls } from '@/components/dashboard/bot-controls';
import { BinanceBalancesDisplay } from '@/components/dashboard/binance-balances-display';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { StrategyDashboard } from '@/components/dashboard/strategy-dashboard';
import { StrategyConditionChart } from '@/components/dashboard/strategy-condition-chart';
import { MarketChart } from '@/components/MarketChart';
import { CHART_COLORS } from '@/components/MarketChart';

// Importaciones de UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


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
    const selectedMarket = useMemo(() => MOCK_MARKETS.find(m => m.id === selectedMarketId) || null, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(true);
    const [balancesError, setBalancesError] = useState<string | null>(null);

    const [operationLogs, setOperationLogs] = useState<any[]>([]);
    const [tradeExecutionLogs, setTradeExecutionLogs] = useState<any[]>([]);

    const { toast } = useToast();

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

    const onBotAction = useCallback((details: any) => {
        const newLog = { ...details, timestamp: Date.now() + Math.random() };
        setOperationLogs(prev => [newLog, ...prev.slice(0, 199)]);
        const isExecutionLog = (details.type === 'order_placed' || details.type === 'order_failed' || (details.type === 'strategy_decision' && details.data?.action !== 'hold'));
        if (isExecutionLog) {
            setTradeExecutionLogs(prev => [newLog, ...prev.slice(0, 99)]);
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
        currentMarketPriceHistory,
    } = useTradingBot({
        selectedMarket,
        allBinanceBalances: currentBalances,
        onBotAction,
    });
    
    const requiredCandles = 51;

    const annotatedHistory = useMemo(() => currentMarketPriceHistory.filter(dp => dp && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)), [currentMarketPriceHistory]);
    const latestDataPointForStrategy = useMemo(() => annotatedHistory.at(-1) || null, [annotatedHistory]);
    const lastStrategyDecision = useMemo(() => operationLogs.find(log => log.type === 'strategy_decision')?.data?.action || 'hold', [operationLogs]);

    const CombinedAnalysisDescription = () => {
        if (!latestDataPointForStrategy || annotatedHistory.length < 2) return "Cargando análisis...";
        const latest = latestDataPointForStrategy;
        
        let trend = "lateral";
        if (isValidNumber(latest.sma50) && isValidNumber(latest.sma10) && isValidNumber(latest.sma20) && latest.sma10 > latest.sma20 && latest.sma20 > latest.sma50) trend = "alcista fuerte";
        else if (isValidNumber(latest.sma10) && isValidNumber(latest.sma20) && latest.sma10 > latest.sma20) trend = "alcista";
        else if (isValidNumber(latest.sma50) && isValidNumber(latest.sma10) && isValidNumber(latest.sma20) && latest.sma10 < latest.sma20 && latest.sma20 < latest.sma50) trend = "bajista fuerte";
        else if (isValidNumber(latest.sma10) && isValidNumber(latest.sma20) && latest.sma10 < latest.sma20) trend = "bajista";
        
        let volatilityDesc = "";
        if (isValidNumber(latest.upperBollingerBand) && isValidNumber(latest.lowerBollingerBand) && latest.closePrice > 0) {
            const volatility = (latest.upperBollingerBand - latest.lowerBollingerBand) / latest.closePrice * 100;
            volatilityDesc = `Volatilidad del ${volatility.toFixed(2)}%.`;
        }

        let momentum = "";
        if (isValidNumber(latest.rsi)) {
            if (latest.rsi > 70) momentum = `RSI en ${latest.rsi.toFixed(1)} (sobrecompra).`;
            else if (latest.rsi < 30) momentum = `RSI en ${latest.rsi.toFixed(1)} (sobreventa).`;
            else momentum = `RSI en ${latest.rsi.toFixed(1)} (neutral).`;
        }
        
        const priceChange = annotatedHistory.length > 1 ? latest.closePrice - annotatedHistory[0].closePrice : 0;
        const pnlSummary = `P&L 24h (sim): ${priceChange.toFixed(2)} USDT (${((priceChange / annotatedHistory[0].closePrice) * 100).toFixed(2)}%).`;

        return `Tendencia ${trend}. ${volatilityDesc} ${momentum} ${pnlSummary}`;
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
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                <SelectContent>
                                    {MOCK_MARKETS.map(market => <SelectItem key={market.id} value={market.id}>{market.symbol}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <BotControls isBotRunning={isBotRunning} onToggleBot={toggleBotStatus} />
                    </CardContent>
                    <CardFooter className="flex-col items-center text-xs text-muted-foreground space-y-1">
                        {selectedMarket && <p><strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket.pricePrecision) : 'Cargando...'}</p>}
                        {currentMarketPriceHistory.length < requiredCandles && selectedMarket && <p className="text-orange-500">El bot necesita {requiredCandles} velas para iniciar. Actual: {currentMarketPriceHistory.length}.</p>}
                        {isPlacingOrder && <p className="text-orange-500 font-semibold">Colocando orden...</p>}
                        {placeOrderError && <p className="text-red-500 font-semibold">Error de Orden: {parseErrorMessage(placeOrderError)}</p>}
                        {rulesLoading && <p className="text-blue-500">Cargando reglas del mercado...</p>}
                        {rulesError && <p className="text-red-500">Error al cargar reglas: {parseErrorMessage(rulesError)}</p>}
                        {balancesError && <p className="text-red-500">Error al cargar balances: {parseErrorMessage(balancesError)}</p>}
                    </CardFooter>
                </Card>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>
                
                {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-3 shadow-lg rounded-xl">
                        <CardHeader><CardTitle>Gráfica de Mercado</CardTitle></CardHeader>
                        <CardContent>
                            <MarketChart data={annotatedHistory} selectedMarket={selectedMarket} strategyLogs={operationLogs} chartColors={CHART_COLORS} />
                        </CardContent>
                        <CardFooter><p className="text-xs text-muted-foreground"><CombinedAnalysisDescription /></p></CardFooter>
                    </Card>
                )}

                 {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-3">
                        <CardHeader><CardTitle>Diagnóstico de Estrategia</CardTitle></CardHeader>
                        <CardContent>
                             <StrategyDashboard latest={latestDataPointForStrategy} decision={lastStrategyDecision} selectedMarket={selectedMarket} priceHistory={annotatedHistory} />
                        </CardContent>
                    </Card>
                )}

                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Análisis de Condiciones</CardTitle></CardHeader>
                    <CardContent>
                        <StrategyConditionChart data={annotatedHistory} />
                    </CardContent>
                </Card>
                
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Libro de Órdenes</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[200px] w-full pr-4">
                            {tradeExecutionLogs.length > 0 ? tradeExecutionLogs.map(log => (
                                <div key={log.timestamp} className="text-xs border-b py-2">
                                    <p><span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span className={`font-semibold ${log.success ? 'text-primary' : 'text-destructive'}`}>{log.message}</span></p>
                                    {log.details && <pre className="text-[10px] bg-muted/50 p-1 mt-1">{typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}</pre>}
                                </div>
                            )) : <p className="text-sm text-muted-foreground">Esperando la primera acción de compra o venta...</p>}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Registro de Operaciones</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[200px] w-full pr-4">
                            {operationLogs.length > 0 ? operationLogs.map(log => (
                                <div key={log.timestamp} className="text-xs border-b py-2">
                                    <p><span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span className={`font-semibold ${log.success ? 'text-primary' : 'text-destructive'}`}>{log.message}</span></p>
                                    {log.details && <pre className="text-[10px] bg-muted/50 p-1 mt-1">{typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}</pre>}
                                </div>
                            )) : <p className="text-sm text-muted-foreground">Esperando la primera acción del bot...</p>}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
