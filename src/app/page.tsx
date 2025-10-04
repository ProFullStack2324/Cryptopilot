"use client"; // Marca este componente como un Client Component en Next.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTradingBot } from '@/hooks/useTradingBot'; // Importa tu hook de trading
import { useToast } from '@/hooks/use-toast'; // Asegúrate de que la ruta sea correcta para useToast
import {
    Market,
    BinanceBalance,
    MarketPriceDataPoint
} from '@/lib/types'; // Importa tus tipos

// Importaciones de Shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"; // Para mostrar el estado del bot
import { ScrollArea } from "@/components/ui/scroll-area"; // Para el área de historial de precios

// IMPORTACIÓN ÚNICA DE GRÁFICA: SOLO MarketChart encapsula toda la lógica de Recharts.
import { getChartLegendItems, CHART_COLORS, MarketChart } from '@/components/MarketChart';
import clsx from 'clsx';
import { Globe } from 'lucide-react'; // Importar el icono
import { StrategyConditionChart } from '@/components/dashboard/strategy-condition-chart';
import { StrategyDashboard } from '@/components/dashboard/strategy-dashboard';

// --- MOCK DE MERCADOS (se usará con datos reales de Binance) ---
const MOCK_MARKETS: Market[] = [
    {
        id: "BTCUSDT",
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        active: true,
        precision: { amount: 5, price: 2, base: 8, quote: 8 },
        limits: { amount: { min: 0.00001, max: 100 }, price: { min: 0.01, max: 1000000 } , cost: { min: 10 } },
        info: {},
        pricePrecision: 2,
        latestPrice: null,
        change24h: null,
    },
    {
        id: "ETHUSDT",
        symbol: "ETHUSDT",
        baseAsset: "ETH",
        quoteAsset: "USDT",
        active: true,
        precision: { amount: 4, price: 2, base: 8, quote: 8 },
        limits: { amount: { min: 0.0001, max: 1000 }, price: { min: 0.01, max: 10000 } , cost: { min: 10 } },
        info: {},
        pricePrecision: 2,
        latestPrice: null,
        change24h: null,
    },
];

// FUNCIÓN AUXILIAR ÚNICA: Para validar si un valor es un número válido (no null, undefined, o NaN).
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// FUNCIÓN AUXILIAR PARA PARSEAR MENSAJES DE ERROR (mejorada)
const parseErrorMessage = (error: string | null): string => {
    if (!error) return "Error desconocido.";
    // No parsear JSON, simplemente devolver el mensaje de error de texto plano que ahora envía la API
    return error;
};


export default function TradingBotControlPanel() {
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>("BTCUSDT");
    const selectedMarket = useMemo(() => {
        return MOCK_MARKETS.find(m => m.id === selectedMarketId) || null;
    }, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(true);
    const [balancesError, setBalancesError] = useState<string | null>(null);

    // Estado para los logs detallados de la estrategia
    const [strategyLogs, setStrategyLogs] = useState<{ timestamp: number; message: string; details?: any; }[]>([]);

    // Estado para conteo de señales
    const [signalCount, setSignalCount] = useState({
        buy: 0,
        sell: 0,
        hold: 0,
    });

    // Estado: Para mostrar errores del gráfico en la UI
    const [chartDisplayError, setChartDisplayError] = useState<string | null>(null);

    const { toast } = useToast();

    // Efecto para cargar balances de Binance y actualizarlos periódicamente
    useEffect(() => {
        const fetchBalances = async () => {
            setBalancesLoading(true);
            setBalancesError(null);
            try {
                const response = await fetch('/api/binance/balance');
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || `Error HTTP ${response.status}`);
                }

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
                console.error("Error al cargar balances:", error);
                setBalancesError(error.message);
            } finally {
                setBalancesLoading(false);
            }
        };

        fetchBalances();
        const balanceInterval = setInterval(fetchBalances, 60000); // Actualiza balances cada 60 segundos
        return () => clearInterval(balanceInterval);
    }, [toast]);

    const onBotAction = useCallback((details: any) => {
        const uniqueTimestamp = Date.now() + Math.random();

        if (details.type === 'strategyExecuted') {
            const decisionAction = details.data?.action || 'hold';
            const displayMessage = details.message || `Decisión de estrategia: ${decisionAction.toUpperCase()}`;

            setStrategyLogs(prevLogs => [
                {
                    timestamp: uniqueTimestamp,
                    message: displayMessage,
                    details: { action: decisionAction, ...details.details }
                },
                ...prevLogs.slice(0, 99)
            ]);
            
            setSignalCount(prev => ({
                ...prev,
                [decisionAction]: prev[decisionAction as 'buy' | 'sell' | 'hold'] + 1
            }));
        }
    }, []);

    const {
        isBotRunning,
        toggleBotStatus,
        botOpenPosition,
        botLastActionTimestamp,
        isPlacingOrder,
        placeOrderError,
        selectedMarketRules,
        rulesLoading,
        rulesError,
        currentPrice,
        currentMarketPriceHistory,
    } = useTradingBot({
        selectedMarket: selectedMarket,
        allBinanceBalances: currentBalances,
        onBotAction: onBotAction,
    });
    
    const requiredCandles = 51;

    useEffect(() => {
        if (currentMarketPriceHistory.some(dp => !isValidNumber(dp.timestamp) || !isValidNumber(dp.closePrice))) {
            const errorMessage = "ERROR: El historial de precios contiene valores no numéricos. El gráfico podría fallar.";
            console.error(errorMessage);
            setChartDisplayError(errorMessage);
        } else if (chartDisplayError) {
            setChartDisplayError(null);
        }
    }, [currentMarketPriceHistory, chartDisplayError]);

    const annotatedHistory = useMemo(() => {
        // Asegúrate de que `currentMarketPriceHistory` es un array antes de usar `filter`
        const validPriceHistory = Array.isArray(currentMarketPriceHistory) 
            ? currentMarketPriceHistory.filter(dp =>
                dp && typeof dp === 'object' && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)
              )
            : [];
    
        if (validPriceHistory.length === 0) return [];
    
        return validPriceHistory.map((dp) => {
            const matchingLog = (strategyLogs || []).find(log =>
                log && isValidNumber(log.timestamp) && Math.abs(log.timestamp - dp.timestamp) < 2000
            );
            let validSignal: 'buy' | 'sell' | 'hold' | undefined = undefined;
            if (matchingLog?.details?.action && ['buy', 'sell', 'hold'].includes(matchingLog.details.action)) {
                validSignal = matchingLog.details.action as 'buy' | 'sell' | 'hold';
            }
            return { ...dp, strategySignal: validSignal };
        });
    }, [currentMarketPriceHistory, strategyLogs]);

    const formatDataPoint = (dataPoint: MarketPriceDataPoint, pricePrecision: number, amountPrecision: number) => {
        if (!dataPoint || !isValidNumber(dataPoint.timestamp)) return null;
        const timestamp = new Date(dataPoint.timestamp).toLocaleTimeString();
        const openPrice = isValidNumber(dataPoint.openPrice) ? dataPoint.openPrice.toFixed(pricePrecision) : 'N/A';
        const highPrice = isValidNumber(dataPoint.highPrice) ? dataPoint.highPrice.toFixed(pricePrecision) : 'N/A';
        const lowPrice = isValidNumber(dataPoint.lowPrice) ? dataPoint.lowPrice.toFixed(pricePrecision) : 'N/A';
        const closePrice = isValidNumber(dataPoint.closePrice) ? dataPoint.closePrice.toFixed(pricePrecision) : 'N/A';
        const volume = isValidNumber(dataPoint.volume) ? dataPoint.volume.toFixed(amountPrecision) : 'N/A';
        const sma10 = isValidNumber(dataPoint.sma10) ? dataPoint.sma10.toFixed(pricePrecision) : 'N/A';
        const sma20 = isValidNumber(dataPoint.sma20) ? dataPoint.sma20.toFixed(pricePrecision) : 'N/A';
        const macdLine = isValidNumber(dataPoint.macdLine) ? dataPoint.macdLine.toFixed(4) : 'N/A';
        const signalLine = isValidNumber(dataPoint.signalLine) ? dataPoint.signalLine.toFixed(4) : 'N/A';
        const macdHistogram = isValidNumber(dataPoint.macdHistogram) ? dataPoint.macdHistogram.toFixed(4) : 'N/A';
        const rsi = isValidNumber(dataPoint.rsi) ? dataPoint.rsi.toFixed(2) : 'N/A';

        return (
            <div key={`datapoint-${dataPoint.timestamp}`} className="text-xs text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 py-1 last:border-b-0">
                <p><strong>Time:</strong> {timestamp}</p>
                <p><strong>O:</strong> {openPrice} | <strong>H:</strong> {highPrice} | <strong>L:</strong> {lowPrice} | <strong>C:</strong> {closePrice} | <strong>V:</strong> {volume}</p>
                <p><strong>SMA10:</strong> {sma10} | <strong>SMA20:</strong> {sma20}</p>
                <p><strong>MACD:</strong> {macdLine} | <strong>Signal:</strong> {signalLine} | <strong>Hist:</strong> {macdHistogram}</p>
                <p><strong>RSI:</strong> {rsi}</p>
            </div>
        );
    };

    const latestCalculations = useMemo(() => {
        if (!Array.isArray(currentMarketPriceHistory) || currentMarketPriceHistory.length === 0) return null;
        const latest = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];
        if (!latest || !isValidNumber(latest.timestamp) || !isValidNumber(latest.closePrice)) return null;
        const pricePrecision = selectedMarket?.pricePrecision || 2;

        return {
            price: isValidNumber(latest.closePrice) ? latest.closePrice.toFixed(pricePrecision) : 'N/A',
            sma10: isValidNumber(latest.sma10) ? latest.sma10.toFixed(pricePrecision) : 'N/A',
            sma20: isValidNumber(latest.sma20) ? latest.sma20.toFixed(pricePrecision) : 'N/A',
            sma50: isValidNumber(latest.sma50) ? latest.sma50.toFixed(pricePrecision) : 'N/A',
            macdLine: isValidNumber(latest.macdLine) ? latest.macdLine.toFixed(4) : 'N/A',
            signalLine: isValidNumber(latest.signalLine) ? latest.signalLine.toFixed(4) : 'N/A',
            macdHistogram: isValidNumber(latest.macdHistogram) ? latest.macdHistogram.toFixed(4) : 'N/A',
            rsi: isValidNumber(latest.rsi) ? latest.rsi.toFixed(2) : 'N/A',
            upperBB: isValidNumber(latest.upperBollingerBand) ? latest.upperBollingerBand.toFixed(pricePrecision) : 'N/A',
            middleBB: isValidNumber(latest.middleBollingerBand) ? latest.middleBollingerBand.toFixed(pricePrecision) : 'N/A',
            lowerBB: isValidNumber(latest.lowerBollingerBand) ? latest.lowerBollingerBand.toFixed(pricePrecision) : 'N/A',
        };
    }, [currentMarketPriceHistory, selectedMarket?.pricePrecision]);

    const latestDataPointForStrategy = useMemo(() => {
        return annotatedHistory.length > 0 ? annotatedHistory[annotatedHistory.length - 1] : null;
    }, [annotatedHistory]);

    const lastStrategyDecision = useMemo(() => {
        const lastLog = strategyLogs.find(log => log.details?.action);
        return lastLog?.details?.action || 'hold';
    }, [strategyLogs]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center">CryptoPilot Bot Control Panel</h1>

            <Card className="w-full mb-6 shadow-lg rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-2xl font-medium">Estado del Bot</CardTitle>
                    <Badge className={`px-3 py-1 text-sm rounded-full ${isBotRunning ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {isBotRunning ? 'ACTIVO' : 'DETENIDO'}
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">Mercado:</span>
                            <Select onValueChange={setSelectedMarketId} value={selectedMarketId || ""}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Selecciona..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {MOCK_MARKETS.map(market => (
                                        <SelectItem key={market.id} value={market.id}>
                                            {market.symbol}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={toggleBotStatus}
                            disabled={!selectedMarket || rulesLoading || !!rulesError || currentMarketPriceHistory.length < requiredCandles}
                            className={`px-6 py-3 rounded-lg font-semibold ${isBotRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors duration-200`}
                        >
                            {isBotRunning ? 'Detener Bot' : 'Iniciar Bot'}
                        </Button>
                    </div>

                    {selectedMarket && (
                         <p className="text-sm text-muted-foreground">
                            <strong>Mercado:</strong> {selectedMarket.symbol} | <strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket.pricePrecision) : 'Cargando...'}
                         </p>
                    )}
                    {currentMarketPriceHistory.length < requiredCandles && selectedMarket && (
                        <p className="text-orange-500 text-sm">El bot requiere al menos {requiredCandles} velas para iniciar. Actual: {currentMarketPriceHistory.length}.</p>
                    )}
                    {isPlacingOrder && <p className="text-orange-500 font-semibold">Colocando orden...</p>}
                    {placeOrderError && <p className="text-red-500 font-semibold">Error de Orden: {parseErrorMessage(placeOrderError)}</p>}
                    {(rulesLoading) && <p className="text-blue-500 text-sm">Cargando reglas del mercado...</p>}
                    {rulesError && <p className="text-red-500 text-sm">Error al cargar reglas: {parseErrorMessage(rulesError)}</p>}
                    {balancesError && <p className="text-red-500 text-sm">Error al cargar balances: {parseErrorMessage(balancesError)}</p>}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                <Card className="shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Reglas del Mercado ({selectedMarket?.symbol || 'N/A'})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {rulesLoading && <p>Cargando reglas...</p>}
                        {rulesError && <p className="text-red-500">{parseErrorMessage(rulesError)}</p>}
                        {selectedMarketRules ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Activo Base:</strong> {selectedMarketRules.baseAsset}</p>
                                <p><strong>Cantidad Mínima:</strong> {selectedMarketRules.lotSize?.minQty || 'N/A'}</p>
                                <p><strong>Nocional Mínimo:</strong> {selectedMarketRules.minNotional?.minNotional || 'N/A'} USDT</p>
                            </div>
                        ) : (!rulesLoading && !rulesError && <p>Selecciona un mercado para ver las reglas.</p>)}
                    </CardContent>
                </Card>

                {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl">
                        <CardHeader><CardTitle>Gráfica de Mercado</CardTitle></CardHeader>
                        <CardContent>
                            <MarketChart
                                data={annotatedHistory}
                                selectedMarket={selectedMarket}
                                strategyLogs={strategyLogs}
                                chartColors={CHART_COLORS}
                            />
                        </CardContent>
                    </Card>
                )}

                 {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl">
                        <CardHeader><CardTitle>Diagnóstico de Estrategia en Tiempo Real</CardTitle></CardHeader>
                        <CardContent>
                             <StrategyDashboard 
                                latest={latestDataPointForStrategy}
                                decision={lastStrategyDecision}
                                selectedMarket={selectedMarket}
                                priceHistory={annotatedHistory}
                             />
                        </CardContent>
                    </Card>
                )}

                 {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl">
                        <CardContent className="pt-6">
                            <StrategyConditionChart data={annotatedHistory} />
                        </CardContent>
                    </Card>
                )}
                {chartDisplayError && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl border-red-500 bg-red-50 dark:bg-red-950">
                        <CardHeader><CardTitle className="text-red-700 dark:text-red-200">Error en Gráfico</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-red-600 dark:text-red-100">{chartDisplayError}</p>
                        </CardContent>
                    </Card>
                )}

                <Card className="shadow-lg rounded-xl">
                    <CardHeader><CardTitle>Balances de Binance</CardTitle></CardHeader>
                    <CardContent>
                        {balancesLoading && <p>Cargando balances...</p>}
                        {balancesError && <p className="text-red-500">{parseErrorMessage(balancesError)}</p>}
                        {currentBalances.length > 0 ? (
                            <ul>
                                {currentBalances.map(bal => (
                                    <li key={bal.asset}><strong>{bal.asset}:</strong> {(bal.free + bal.locked).toFixed(4)}</li>
                                ))}
                            </ul>
                        ) : (!balancesLoading && !balancesError && <p>No se encontraron balances significativos.</p>)}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 shadow-lg rounded-xl">
                    <CardHeader><CardTitle>Posición Abierta del Bot</CardTitle></CardHeader>
                    <CardContent>
                        {botOpenPosition ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Mercado:</strong> {botOpenPosition.marketId}</p>
                                <p><strong>Tipo:</strong> <Badge className={`${botOpenPosition.type === 'buy' ? 'bg-blue-500' : 'bg-red-500'} text-white`}>{botOpenPosition.type.toUpperCase()}</Badge></p>
                                <p><strong>Cantidad:</strong> {botOpenPosition.amount.toFixed(selectedMarket?.precision.amount || 4)} {selectedMarket?.baseAsset}</p>
                                <p><strong>Precio de Entrada:</strong> {botOpenPosition.entryPrice.toFixed(selectedMarket?.pricePrecision || 2)} {selectedMarket?.quoteAsset}</p>
                                <p><strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket?.pricePrecision || 2) : 'N/A'}</p>
                                {currentPrice && (
                                    <p>
                                        <strong>PnL:</strong>{" "}
                                        {((currentPrice - botOpenPosition.entryPrice) * botOpenPosition.amount).toFixed(2)}{' '}
                                        {selectedMarket?.quoteAsset}{' '}
                                        <span className={`font-semibold ${((currentPrice - botOpenPosition.entryPrice) * botOpenPosition.amount) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            ({(((currentPrice - botOpenPosition.entryPrice) / botOpenPosition.entryPrice) * 100).toFixed(2)}%)
                                        </span>
                                    </p>
                                )}
                            </div>
                        ) : (<p>No hay posición abierta.</p>)}
                        {botLastActionTimestamp && <p className="text-xs text-gray-500 mt-2">Última acción: {new Date(botLastActionTimestamp).toLocaleString()}</p>}
                    </CardContent>
                </Card>

                <Card className="shadow-lg rounded-xl">
                    <CardHeader><CardTitle>Indicadores Recientes</CardTitle></CardHeader>
                    <CardContent>
                        {latestCalculations ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Precio:</strong> {latestCalculations.price}</p>
                                <p><strong>SMA10:</strong> {latestCalculations.sma10}</p>
                                <p><strong>SMA20:</strong> {latestCalculations.sma20}</p>
                                <p><strong>RSI:</strong> {latestCalculations.rsi}</p>
                            </div>
                        ) : (<p>Cargando indicadores...</p>)}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-blue-500">
                    <CardHeader><CardTitle>Conteo de Señales</CardTitle></CardHeader>
                    <CardContent>
                        <ul>
                            <li><strong>Buy:</strong> <span className="font-bold">{signalCount.buy}</span></li>
                            <li><strong>Sell:</strong> <span className="font-bold">{signalCount.sell}</span></li>
                            <li><strong>Hold:</strong> <span className="font-bold">{signalCount.hold}</span></li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="w-full max-w-7xl mt-4 shadow-lg rounded-xl lg:col-span-2">
                    <CardHeader><CardTitle>Historial y Logs</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full pr-4">
                            {annotatedHistory.slice().reverse().filter(dp => isValidNumber(dp.timestamp)).map((dp, index) =>
                                <div key={`datapoint-${dp.timestamp}-${index}`}>{formatDataPoint(dp, selectedMarket?.pricePrecision || 2, selectedMarket?.precision.amount || 2)}</div>
                            )}
                            {strategyLogs.slice().reverse().map((log, index) => (
                                <div key={`log-${log.timestamp}-${index}`} className="text-xs text-blue-700 dark:text-blue-300 border-b border-gray-200 dark:border-gray-700 py-1">
                                    <p><strong>LOG [{new Date(log.timestamp).toLocaleTimeString()}]:</strong> {log.message}</p>
                                    {log.details && <pre className="text-[10px]">{JSON.stringify(log.details, null, 2)}</pre>}
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
