
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { CHART_COLORS, MarketChart } from '@/components/MarketChart';
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
    return error;
};


export default function TradingBotControlPanel() {
    const [selectedMarketId, setSelectedMarketId] = useState<string>("BTCUSDT");
    const selectedMarket = useMemo(() => {
        return MOCK_MARKETS.find(m => m.id === selectedMarketId) || null;
    }, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(true);
    const [balancesError, setBalancesError] = useState<string | null>(null);

    // Estado para logs de operaciones y decisiones
    const [operationLogs, setOperationLogs] = useState<any[]>([]);
    const [tradeExecutionLogs, setTradeExecutionLogs] = useState<any[]>([]);


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
    }, []);

    const onBotAction = useCallback((details: any) => {
        const uniqueTimestamp = Date.now() + Math.random();
        const newLog = { ...details, timestamp: uniqueTimestamp };

        // 1. Añadir CUALQUIER log al historial general.
        setOperationLogs(prevLogs => [newLog, ...prevLogs.slice(0, 199)]);

        // 2. Si es una decisión de estrategia, actualiza el contador de señales.
        if (details.type === 'strategy_decision' && details.data?.action) {
            const decisionAction = details.data.action as 'buy' | 'sell' | 'hold';
            if (['buy', 'sell', 'hold'].includes(decisionAction)) {
                setSignalCount(prev => ({ ...prev, [decisionAction]: (prev[decisionAction] || 0) + 1 }));
            }
        }
        
        // 3. Añadir SOLO logs de ejecución (compra/venta) al registro de ejecución.
        const isExecutionLog = (details.type === 'order_placed' || details.type === 'order_failed' || (details.type === 'strategy_decision' && details.data?.action !== 'hold'));
        if (isExecutionLog) {
            setTradeExecutionLogs(prevLogs => [newLog, ...prevLogs.slice(0, 99)]);
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
        return (currentMarketPriceHistory || []).filter(dp =>
            dp && typeof dp === 'object' && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)
        );
    }, [currentMarketPriceHistory]);
    
    const latestDataPointForStrategy = useMemo(() => {
        return annotatedHistory.length > 0 ? annotatedHistory[annotatedHistory.length - 1] : null;
    }, [annotatedHistory]);

    const lastStrategyDecision = useMemo(() => {
        // Encontrar el último log que sea una decisión de estrategia
        const lastDecisionLog = operationLogs.find(log => log.type === 'strategy_decision');
        return lastDecisionLog?.data?.action || 'hold';
    }, [operationLogs]);

    const CombinedAnalysisDescription = () => {
        const lastDecisionLog = operationLogs.find(log => log.type === 'strategy_decision');
    
        // --- Análisis de Mercado ---
        let marketDesc = "Cargando análisis de mercado...";
        if (latestDataPointForStrategy) {
            const { closePrice, rsi, upperBollingerBand, lowerBollingerBand, sma10, sma20, sma50 } = latestDataPointForStrategy;
    
            if ([closePrice, sma10, sma20].every(isValidNumber)) {
                let trend = "lateral";
                if (isValidNumber(sma50) && sma10 > sma20 && sma20 > sma50) trend = "alcista fuerte";
                else if (sma10 > sma20) trend = "alcista";
                else if (isValidNumber(sma50) && sma10 < sma20 && sma20 < sma50) trend = "bajista fuerte";
                else if (sma10 < sma20) trend = "bajista";
    
                let volatilityDesc = "";
                if (isValidNumber(upperBollingerBand) && isValidNumber(lowerBollingerBand)) {
                    const volatility = (upperBollingerBand - lowerBollingerBand) / closePrice * 100;
                    volatilityDesc = `Volatilidad del ${volatility.toFixed(2)}%.`;
                    if (volatility < 1) volatilityDesc += " Mercado comprimido.";
                    if (volatility > 4) volatilityDesc += " Alta volatilidad.";
                }
    
                let momentum = "";
                if (isValidNumber(rsi)) {
                    momentum = `RSI en ${rsi.toFixed(1)} (neutral).`;
                    if (rsi > 70) momentum = `RSI en ${rsi.toFixed(1)} (sobrecompra).`;
                    if (rsi < 30) momentum = `RSI en ${rsi.toFixed(1)} (sobreventa).`;
                }
                marketDesc = `Tendencia ${trend}. ${volatilityDesc} ${momentum}.`;
            } else {
                marketDesc = "Datos de tendencia insuficientes.";
            }
        }
    
        // --- Análisis de Estrategia ---
        let strategyDesc = " | Conclusión del Bot: MANTENER. Monitoreando mercado.";
        if (lastDecisionLog?.data?.details) {
            const { action, details } = lastDecisionLog.data;
            const { buyConditionsCount, conditions } = details?.decisionDetails || {};
            
            const fulfilledBuy: string[] = [];
            const missingBuy: string[] = [];

            if (conditions) {
                if (conditions.price) fulfilledBuy.push("Precio en BB Inferior"); else missingBuy.push("Precio en BB Inferior");
                if (conditions.rsi) fulfilledBuy.push("RSI en Sobreventa"); else missingBuy.push("RSI en Sobreventa");
                if (conditions.macd) fulfilledBuy.push("Cruce MACD alcista"); else missingBuy.push("Cruce MACD alcista");
            }
    
            if (action === 'buy') {
                strategyDesc = ` | Conclusión del Bot: COMPRA. Se cumplieron ${buyConditionsCount}/2 condiciones: [${fulfilledBuy.join(', ')}].`;
            } else if (action === 'sell') {
                strategyDesc = " | Conclusión del Bot: VENTA. La estrategia detectó una o más condiciones de salida.";
            } else if (isValidNumber(buyConditionsCount)) {
                 strategyDesc = ` | Conclusión: MANTENER. Cumplidas ${buyConditionsCount}/2: [${fulfilledBuy.map(c => `✅ ${c}`).join(' ')}]. Faltó: [${missingBuy.map(c => `❌ ${c}`).join(' ')}].`;
            } else {
                 strategyDesc = " | Conclusión: MANTENER. Ninguna condición de entrada o salida se cumple. Monitoreando.";
            }
        }
        
        return `${marketDesc}${strategyDesc}`;
    };

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

                     {selectedMarket && !rulesError && (
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
                                <p><strong>Cantidad Mínima:</strong> {isValidNumber(selectedMarketRules.lotSize?.minQty) ? selectedMarketRules.lotSize.minQty : 'N/A'}</p>
                                <p><strong>Nocional Mínimo:</strong> {isValidNumber(selectedMarketRules.minNotional?.minNotional) ? `${selectedMarketRules.minNotional.minNotional} USDT` : 'N/A'}</p>
                            </div>
                        ) : (!rulesLoading && !rulesError && <p>Selecciona un mercado para ver las reglas.</p>)}
                    </CardContent>
                </Card>

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
                
                {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl">
                        <CardHeader><CardTitle>Gráfica de Mercado</CardTitle></CardHeader>
                        <CardContent>
                            <MarketChart
                                data={annotatedHistory}
                                selectedMarket={selectedMarket}
                                strategyLogs={operationLogs}
                            />
                        </CardContent>
                        <CardFooter>
                            <p className="text-xs text-muted-foreground"><CombinedAnalysisDescription /></p>
                        </CardFooter>
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
                        <CardHeader>
                            <CardTitle>Análisis de Condiciones de Estrategia</CardTitle>
                            <CardDescription>Visualiza qué condiciones de compra (arriba) o venta (abajo) se cumplen en cada vela.</CardDescription>
                        </CardHeader>
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

                <Card className="lg:col-span-2 shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Libro de Órdenes</CardTitle>
                        <CardDescription>Historial de intentos de compra/venta y su resultado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] w-full pr-4">
                            {tradeExecutionLogs.length > 0 ? (
                                tradeExecutionLogs.map((log) => (
                                    <div key={log.timestamp} className="text-xs border-b border-border py-2">
                                        <p>
                                            <span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                            <span className={`font-semibold ${log.success ? 'text-primary' : 'text-destructive'}`}>
                                                {log.message}
                                            </span>
                                        </p>
                                        {log.details && (
                                            <pre className="text-[10px] bg-muted/50 p-1 rounded-sm mt-1 overflow-auto">
                                                {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                                            </pre>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Esperando la primera acción de compra o venta...</p>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                
                <Card className="lg:col-span-2 shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Registro de Operaciones y Decisiones</CardTitle>
                        <CardDescription>Historial de intentos de trade, operaciones y decisiones de la estrategia.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] w-full pr-4">
                            {operationLogs.length > 0 ? (
                                operationLogs.map((log) => (
                                    <div key={log.timestamp} className="text-xs border-b border-border py-2">
                                        <p>
                                            <span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                            <span className={`font-semibold ${log.success ? 'text-primary' : 'text-destructive'}`}>
                                                {log.message}
                                            </span>
                                        </p>
                                        {log.details && (
                                            <pre className="text-[10px] bg-muted/50 p-1 rounded-sm mt-1 overflow-auto">
                                                {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                                            </pre>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">Esperando la primera acción del bot...</p>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

            </div>
        </div>
    );

    

}
