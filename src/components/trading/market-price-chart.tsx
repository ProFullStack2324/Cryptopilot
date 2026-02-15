"use client"; // Marca este componente como un Client Component en Next.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTradingBot } from '@/hooks/useTradingBot'; // Importa tu hook de trading
import { useToast } from '@/hooks/use-toast'; // Asegúrate de que la ruta sea correcta para useToast
import {
    Market,
    BinanceBalance,
    MarketPriceDataPoint,
    MarketRules,
    BotOpenPosition
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
import { CHART_COLORS, MarketChart } from '@/components/MarketChart';
import clsx from 'clsx';

// --- MOCK DE MERCADOS (se usará con datos reales de Binance) ---


const MOCK_MARKETS: Market[] = [
    {
        id: "BTCUSDT",
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        active: true,
        precision: { amount: 5, price: 2, base: 8, quote: 8 },
        amountPrecision: 5,
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
        amountPrecision: 4,
        limits: { amount: { min: 0.0001, max: 1000 }, price: { min: 0.01, max: 10000 } , cost: { min: 10 } },
        info: {},
        pricePrecision: 2,
        latestPrice: null,
        change24h: null,
    },
];

// FUNCIÓN AUXILIAR ÚNICA: Para validar si un valor es un número válido (no null, undefined, o NaN).
// Esta función debe estar declarada solo una vez.
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

export default function TradingBotControlPanel() {
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
    const selectedMarket = useMemo(() => {
        return MOCK_MARKETS.find(m => m.id === selectedMarketId) || null;
    }, [selectedMarketId]);

    const [currentBalances, setCurrentBalances] = useState<BinanceBalance[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(false);
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
                const response = await fetch('/api/binance/trade?balance=true');
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.success && data.balance) {
                    const fetchedBalances: BinanceBalance[] = Object.keys(data.balance.free).map(asset => ({
                        asset: asset,
                        free: parseFloat(data.balance.free[asset]),
                        locked: parseFloat(data.balance.used[asset]),
                    })).filter(b => b.free > 0 || b.locked > 0);
                    setCurrentBalances(fetchedBalances);
                    toast({
                        title: "Balances Actualizados",
                        description: "Balances de Binance cargados con éxito.",
                        variant: "default",
                        className: "bg-green-500 text-white",
                    });
                } else {
                    throw new Error(data.message || "Error al cargar balances de Binance.");
                }
            } catch (error: any) {
                console.error("Error al cargar balances:", error);
                setBalancesError(error.message);
                toast({
                    title: "Error al cargar balances",
                    description: error.message,
                    variant: "destructive",
                });
            } finally {
                setBalancesLoading(false);
            }
        };

        fetchBalances();
        const balanceInterval = setInterval(fetchBalances, 10000); // Actualiza balances cada 10 segundos
        return () => clearInterval(balanceInterval);
    }, [toast]);

    // Callback para manejar las acciones del bot y actualizar los logs de estrategia
    const onBotAction = useCallback((details: {
        type: string;
        message?: string;
        data?: {
            action?: string;
            [key: string]: any;
        };
        details?: any;
    }) => {
        console.log("LOG: onBotAction - Recibiendo detalles del bot:", JSON.stringify(details, null, 2));
        if (details.type === 'strategyExecuted') {
            const decisionAction = details.data?.action || 'hold';
            
            // Log que muestra la acción de decisión REAL que se está procesando
            console.log(`LOG: onBotAction - Decisión de estrategia procesada: "${decisionAction.toUpperCase()}"`);


            const displayMessage = details.message || `Decisión de estrategia: ${decisionAction.toUpperCase()}`;

            setStrategyLogs(prevLogs => [
                {
                    timestamp: Date.now(),
                    message: displayMessage,
                    details: { action: decisionAction, ...details.details }
                },
                ...prevLogs.slice(0, 99) // Mantiene un historial limitado de logs
            ]);
            
            // Actualización de signalCount (el contador inconsistente)
            setSignalCount(prev => ({
                ...prev,
                [decisionAction]: prev[decisionAction as 'buy' | 'sell' | 'hold'] + 1
            }));
        }
    }, []);


    // Usa el hook de trading
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
        currentMarketPriceHistory, // <-- Este es el historial de precios "crudo" del bot
    } = useTradingBot({
        selectedMarket: selectedMarket,
        allBinanceBalances: currentBalances,
        onBotAction: onBotAction,
        timeframe: "1m"
    });
    const requiredCandles = 35; // Mínimo de velas necesarias para la estrategia

    // LOG DEPURACIÓN Y ACTUALIZACIÓN DE ERROR EN UI: Inspeccionar el historial de precios directamente desde useTradingBot
    useEffect(() => {
        console.log("DEBUG: currentMarketPriceHistory (RAW):", currentMarketPriceHistory);
        if (currentMarketPriceHistory.some(dp => !isValidNumber(dp.timestamp) || !isValidNumber(dp.closePrice))) {
            const errorMessage = "ERROR: currentMarketPriceHistory contiene valores no numéricos en timestamp o closePrice. El gráfico podría fallar.";
            console.error(errorMessage);
            setChartDisplayError(errorMessage); // Muestra el error en la UI
        } else if (chartDisplayError) {
            setChartDisplayError(null); // Limpia el error si los datos vuelven a ser válidos
        }
    }, [currentMarketPriceHistory, chartDisplayError]);


    // DECLARACIÓN ÚNICA Y FINAL de annotatedHistory: Garantiza datos limpios para MarketChart.
    // Esta es la fuente de datos limpia para el gráfico y la lista de historial.
    const annotatedHistory = useMemo(() => {
        // Primer filtro: Asegurarse de que `currentMarketPriceHistory` exista y contenga objetos válidos,
        // y que `timestamp` y `closePrice` sean números válidos.
        const validPriceHistory = (currentMarketPriceHistory || []).filter(dp =>
            dp && typeof dp === 'object' && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)
        );

        // Si no hay historial de precios válido, retorna un array vacío.
        if (validPriceHistory.length === 0) {
            console.warn("DEBUG: annotatedHistory es un array vacío después del filtro de validez.");
            // No establecemos error aquí ya que un array vacío puede ser un estado normal (ej. al inicio).
            return [];
        }

        // Anotar cada punto de datos de precio válido con su señal de estrategia.
        const annotated = validPriceHistory.map((dp) => {
            // Asegurarse de que `strategyLogs` sea un array válido antes de buscar.
            const safeStrategyLogs = Array.isArray(strategyLogs) ? strategyLogs : [];

            // Buscar un log de estrategia que coincida con el timestamp del punto de precio actual.
            const matchingLog = safeStrategyLogs.find(log =>
                log && typeof log === 'object' && isValidNumber(log.timestamp) && Math.abs(log.timestamp - dp.timestamp) < 2000
            );

            // Inicializar la señal como indefinida.
            let validSignal: 'buy' | 'sell' | 'hold' | undefined = undefined;

            // Si se encontró un log coincidente y tiene un detalle de acción válido (un string)
            if (matchingLog?.details && typeof matchingLog.details.action === 'string') {
                const rawSignal = matchingLog.details.action;
                // Si la acción es una de las señales esperadas, asígnala.
                if (rawSignal === 'buy' || rawSignal === 'sell' || rawSignal === 'hold') {
                    validSignal = rawSignal;
                }
            }

            return {
                ...dp, // Incluye todas las propiedades originales del data point (timestamp, closePrice, etc.)
                strategySignal: validSignal, // Añade la señal validada al punto de datos.
            };
        });

        // LOG DEPURACIÓN Y ACTUALIZACIÓN DE ERROR EN UI: Inspeccionar el historial de precios ANOTADO antes de pasarlo al gráfico
        console.log("DEBUG: annotatedHistory (CLEANED & ANNOTATED):", annotated);
        if (annotated.some(dp => !isValidNumber(dp.timestamp) || !isValidNumber(dp.closePrice))) {
             const errorMessage = "ERROR: annotatedHistory contiene valores no numéricos después de la anotación. El gráfico podría fallar.";
             console.error(errorMessage);
             setChartDisplayError(errorMessage); // Muestra el error en la UI
        } else if (chartDisplayError) {
             setChartDisplayError(null); // Limpia el error si los datos vuelven a ser válidos
        }
        return annotated;
    }, [currentMarketPriceHistory, strategyLogs, chartDisplayError]); // Dependencias para el useMemo


    // Función para formatear y mostrar los puntos de datos del historial en la lista lateral.
    const formatDataPoint = (dataPoint: MarketPriceDataPoint, pricePrecision: number, amountPrecision: number) => {
        // Asegurarse de que dataPoint no sea null/undefined y tenga las propiedades esperadas
        if (!dataPoint || !isValidNumber(dataPoint.timestamp)) {
            console.error("formatDataPoint: dataPoint o timestamp inválido", dataPoint);
            return null; // Retorna null si el punto de dato es inválido, para que no se renderice
        }

        const timestamp = new Date(dataPoint.timestamp).toLocaleTimeString();

        // Validar y formatear precios.
        const openPrice = isValidNumber(dataPoint.openPrice) ? dataPoint.openPrice.toFixed(pricePrecision) : 'N/A';
        const highPrice = isValidNumber(dataPoint.highPrice) ? dataPoint.highPrice.toFixed(pricePrecision) : 'N/A';
        const lowPrice = isValidNumber(dataPoint.lowPrice) ? dataPoint.lowPrice.toFixed(pricePrecision) : 'N/A';
        const closePrice = isValidNumber(dataPoint.closePrice) ? dataPoint.closePrice.toFixed(pricePrecision) : 'N/A';
        const volume = isValidNumber(dataPoint.volume) ? dataPoint.volume.toFixed(amountPrecision) : 'N/A';

        // Validar y formatear indicadores.
        const sma10 = isValidNumber(dataPoint.sma10) ? dataPoint.sma10.toFixed(pricePrecision) : 'N/A';
        const sma20 = isValidNumber(dataPoint.sma20) ? dataPoint.sma20.toFixed(pricePrecision) : 'N/A';
        const macdLine = isValidNumber(dataPoint.macdLine) ? dataPoint.macdLine.toFixed(4) : 'N/A';
        const signalLine = isValidNumber(dataPoint.signalLine) ? dataPoint.signalLine.toFixed(4) : 'N/A';
        const macdHistogram = isValidNumber(dataPoint.macdHistogram) ? dataPoint.macdHistogram.toFixed(4) : 'N/A';
        const rsi = isValidNumber(dataPoint.rsi) ? dataPoint.rsi.toFixed(2) : 'N/A';
        const sma50 = isValidNumber(dataPoint.sma50) ? dataPoint.sma50.toFixed(pricePrecision) : 'N/A';
        const upperBB = isValidNumber(dataPoint.upperBollingerBand) ? dataPoint.upperBollingerBand.toFixed(pricePrecision) : 'N/A';
        const middleBB = isValidNumber(dataPoint.middleBollingerBand) ? dataPoint.middleBollingerBand.toFixed(pricePrecision) : 'N/A';
        const lowerBB = isValidNumber(dataPoint.lowerBollingerBand) ? dataPoint.lowerBollingerBand.toFixed(pricePrecision) : 'N/A';


        return (
            <div key={dataPoint.timestamp} className="text-xs text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 py-1 last:border-b-0">
                <p><strong>Time:</strong> {timestamp}</p>
                <p><strong>O:</strong> {openPrice} | <strong>H:</strong> {highPrice} | <strong>L:</strong> {lowPrice} | <strong>C:</strong> {closePrice} | <strong>V:</strong> {volume}</p>
                <p><strong>SMA10:</strong> {sma10} | <strong>SMA20:</strong> {sma20}</p>
                <p><strong>MACD:</strong> {macdLine} | <strong>Signal:</strong> {signalLine} | <strong>Hist:</strong> {macdHistogram}</p>
                <p><strong>RSI:</strong> {rsi}</p>
            </div>
        );
    };

    const StrategyDashboard = ({
        latest,
        decision,
        selectedMarket
    }: {
        latest: MarketPriceDataPoint | null;
        decision: string;
        selectedMarket: Market | null;
    }) => {
        if (!latest || !selectedMarket) return null;

        const pricePrecision = selectedMarket.pricePrecision;
        // Validar que los valores sean números antes de llamar a toFixed.
        const rsi = isValidNumber(latest.rsi) ? latest.rsi.toFixed(2) : 'N/A';
        const macdLine = isValidNumber(latest.macdLine) ? latest.macdLine.toFixed(4) : 'N/A';
        const signalLine = isValidNumber(latest.signalLine) ? latest.signalLine.toFixed(4) : 'N/A';
        const macdHist = isValidNumber(latest.macdHistogram) ? latest.macdHistogram.toFixed(4) : 'N/A';
        const sma10 = isValidNumber(latest.sma10) ? latest.sma10.toFixed(pricePrecision) : 'N/A';
        const sma20 = isValidNumber(latest.sma20) ? latest.sma20.toFixed(pricePrecision) : 'N/A';
        const volume = isValidNumber(latest.volume) ? latest.volume.toFixed(3) : 'N/A';


        const indicatorStatus = (condition: boolean) =>
            condition ? "bg-green-200 text-green-900" : "bg-red-200 text-red-900";

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
                <Card className={clsx("shadow-lg", decision === 'buy' ? "border-green-500" : decision === 'sell' ? "border-red-500" : "border-gray-300")}>
                    <CardHeader>
                        <CardTitle className="text-lg">Señal Actual</CardTitle>
                        <CardDescription>{new Date(latest.timestamp).toLocaleTimeString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className={clsx("text-xl font-bold", {
                            'text-green-600': decision === 'buy',
                            'text-red-600': decision === 'sell',
                            'text-gray-600': decision === 'hold'
                        })}>
                            {decision.toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">Precio: {isValidNumber(latest.closePrice) ? latest.closePrice.toFixed(pricePrecision) : 'N/A'} {selectedMarket.quoteAsset}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Indicadores Principales</CardTitle></CardHeader>
                    <CardContent>
                        <ul className="text-sm space-y-1">
                            <li><strong>RSI:</strong> <span className={indicatorStatus(isValidNumber(latest.rsi) && latest.rsi < 75 && latest.rsi > 30)}>{rsi}</span></li>
                            <li><strong>SMA10:</strong> {sma10} | <strong>SMA20:</strong> {sma20}</li>
                            <li><strong>MACD:</strong> <span className="font-mono">{macdLine}</span></li>
                            <li><strong>Signal:</strong> <span className="font-mono">{signalLine}</span></li>
                            <li><strong>Hist:</strong> <span className={indicatorStatus(isValidNumber(latest.macdHistogram) && latest.macdHistogram > 0)}>{macdHist}</span></li>
                            <li><strong>Volumen:</strong> {volume}</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        );
    };

    // Función para obtener los últimos cálculos de indicadores de la vela más reciente
    const latestCalculations = useMemo(() => {
        if (currentMarketPriceHistory.length === 0) return null;
        const latest = currentMarketPriceHistory[currentMarketPriceHistory.length - 1];

        // Se valida el último punto de dato antes de usarlo.
        if (!latest || !isValidNumber(latest.timestamp) || !isValidNumber(latest.closePrice)) {
            return null;
        }

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
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold">Seleccionar Mercado:</span>
                        <Select onValueChange={setSelectedMarketId} value={selectedMarketId || ""}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Selecciona un mercado" />
                            </SelectTrigger>
                            <SelectContent>
                                {MOCK_MARKETS.map(market => (
                                    <SelectItem key={market.id} value={market.id}>
                                        {market.symbol}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={toggleBotStatus}
                            // Deshabilitar el botón si no hay mercado seleccionado, reglas cargando, o error en reglas.
                            disabled={!selectedMarket || rulesLoading || rulesError !== null || currentMarketPriceHistory.length < requiredCandles}
                            className={`px-6 py-3 rounded-lg font-semibold ${isBotRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors duration-200`}
                        >
                            {isBotRunning ? 'Detener Bot' : 'Iniciar Bot'}
                        </Button>
                    </div>

                    {selectedMarket && (
                        <p className="text-sm">
                            **Mercado:** {selectedMarket.symbol} | **Precio de Cierre Actual:** {currentPrice !== null ? currentPrice.toFixed(selectedMarket.pricePrecision) : 'Cargando...'}
                        </p>
                    )}
                    {currentMarketPriceHistory.length < requiredCandles && selectedMarket && (
                            <p className="text-orange-500 text-sm">
                                El bot requiere al menos {requiredCandles} velas históricas reales para iniciar. Actual: {currentMarketPriceHistory.length}.
                            </p>
                        )}
                    {isPlacingOrder && (
                        <p className="text-orange-500 font-semibold">Colocando orden...</p>
                    )}
                    {placeOrderError && (
                        <p className="text-red-500 font-semibold">Error de Orden: {placeOrderError}</p>
                    )}
                    {(rulesLoading || balancesLoading) && (
                            <p className="text-blue-500 text-sm">Cargando reglas y balances iniciales...</p>
                        )}
                    {rulesError && (
                            <p className="text-red-500 text-sm">Error al cargar reglas: {rulesError}</p>
                        )}
                    {balancesError && (
                            <p className="text-red-500 text-sm">Error al cargar balances: {balancesError}</p>
                        )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                
                {/* Panel de Reglas del Mercado (columna izquierda) */}
                <Card className="shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Reglas del Mercado ({selectedMarket?.symbol || 'N/A'})</CardTitle>
                        <CardDescription>Reglas de Binance para el mercado seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {rulesLoading && <p>Cargando reglas...</p>}
                        {rulesError && <p className="text-red-500">Error al cargar reglas: {rulesError}</p>}
                        {selectedMarketRules ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Estado:</strong> {selectedMarketRules.status}</p>
                                <p><strong>Activo Base:</strong> {selectedMarketRules.baseAsset}</p>
                                <p><strong>Activo de Cotización:</strong> {selectedMarketRules.quoteAsset}</p>
                                <p><strong>Cantidad Mínima:</strong> {selectedMarketRules.lotSize?.minQty || 'N/A'}</p>
                                <p><strong>Tamaño de Paso:</strong> {selectedMarketRules.lotSize?.stepSize || 'N/A'}</p>
                                <p><strong>Nocional Mínimo:</strong> {selectedMarketRules.minNotional?.minNotional || 'N/A'} USDT</p>
                                <p><strong>Precisión del Precio:</strong> {selectedMarketRules.priceFilter?.tickSize || 'N/A'}</p>
                            </div>
                        ) : (
                            !rulesLoading && !rulesError && <p>No hay reglas de mercado cargadas.</p>
                        )}
                    </CardContent>
                </Card>


                {/* GRÁFICA PRINCIPAL: MarketChart (se renderiza aquí para una estructura clara) */}
                {/* Solo se renderiza si hay datos anotados para el historial */}
                {annotatedHistory.length > 0 && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl">
                        <CardHeader>
                            <CardTitle>Gráfica Unificada de Mercado</CardTitle>
                            <CardDescription>
                                Visualización combinada de Velas Japonesas, SMA, RSI, MACD y Señales en tiempo real.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MarketChart
                                data={annotatedHistory} // Los datos del historial ya anotados y limpios
                                selectedMarket={selectedMarket}
                                strategyLogs={strategyLogs}
                                chartColors={CHART_COLORS}
                            />
                        </CardContent>
                    </Card>
                )}
                 {/* Panel para mostrar errores del gráfico */}
                {chartDisplayError && (
                    <Card className="lg:col-span-2 shadow-lg rounded-xl border-red-500 bg-red-50 dark:bg-red-950">
                        <CardHeader>
                            <CardTitle className="text-red-700 dark:text-red-200">Error en el Gráfico</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-red-600 dark:text-red-100 text-sm">
                                {chartDisplayError}
                            </p>
                            <p className="text-red-600 dark:text-red-100 text-xs mt-2">
                                Por favor, revisa la consola del navegador para más detalles (F12 o Clic derecho &gt; Inspeccionar &gt; Consola).
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Panel de Balances (columna derecha) */}
                <Card className="shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Balances de Binance</CardTitle>
                        <CardDescription>Tus balances actuales en Binance Mainnet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {balancesLoading && <p>Cargando balances...</p>}
                        {balancesError && <p className="text-red-500">Error al cargar balances: {balancesError}</p>}
                        {currentBalances.length > 0 ? (
                            <ul className="text-sm space-y-1">
                                {currentBalances.map(bal => (
                                    <li key={bal.asset}>
                                        <strong>{bal.asset}:</strong> Disponible: {bal.free.toFixed(4)}{' '}
                                        | En Orden: {bal.locked.toFixed(4)}{' '}
                                        | Total: {(bal.free + bal.locked).toFixed(4)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            !balancesLoading && !balancesError && <p>No se encontraron balances o no se han cargado.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Panel de Posición Abierta del Bot (ancho completo) */}
                <Card className="lg:col-span-2 shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Posición Abierta del Bot</CardTitle>
                        <CardDescription>Detalles de la posición actual gestionada por el bot.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {botOpenPosition ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Mercado:</strong> {botOpenPosition.marketId}</p>
                                <p><strong>Tipo:</strong> <Badge className={`${botOpenPosition.type === 'buy' ? 'bg-blue-500' : 'bg-red-500'} text-white`}>{botOpenPosition.type.toUpperCase()}</Badge></p>
                                <p><strong>Cantidad:</strong> {botOpenPosition.amount.toFixed(selectedMarket?.precision.amount || 4)} {selectedMarket?.baseAsset}</p>
                                <p><strong>Precio de Entrada:</strong> {botOpenPosition.entryPrice.toFixed(selectedMarket?.pricePrecision || 2)} {selectedMarket?.quoteAsset}</p>
                                <p><strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket?.pricePrecision || 2) : 'N/A'}</p>
                                <p><strong>Stop Loss:</strong> {botOpenPosition.stopLossPrice?.toFixed(selectedMarket?.pricePrecision || 2) || 'N/A'}</p>
                                <p><strong>Take Profit:</strong> {botOpenPosition.takeProfitPrice?.toFixed(selectedMarket?.pricePrecision || 2) || 'N/A'}</p>
                                {currentPrice && (
                                    <p>
                                        <strong>PnL (Flotante):</strong>{" "}
                                        {((currentPrice - botOpenPosition.entryPrice) * botOpenPosition.amount).toFixed(2)}{' '}
                                        {selectedMarket?.quoteAsset}{' '}
                                        <span className={`font-semibold ${((currentPrice - botOpenPosition.entryPrice) * botOpenPosition.amount) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            ({(((currentPrice - botOpenPosition.entryPrice) / botOpenPosition.entryPrice) * 100).toFixed(2)}%)
                                        </span>
                                    </p>
                                )}
                                <p><strong>Abierta Desde:</strong> {new Date(botOpenPosition.timestamp).toLocaleString()}</p>
                            </div>
                        ) : (
                            <p>No hay posición abierta actualmente.</p>
                        )}
                        {botLastActionTimestamp && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Última acción del bot: {new Date(botLastActionTimestamp).toLocaleString()}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Panel de Cálculos de Indicadores Recientes (TEXTO) - REUBICADO */}
                <Card className="shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Cálculos de Indicadores Recientes</CardTitle>
                        <CardDescription>Valores de indicadores de la última vela procesada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {latestCalculations ? (
                            <div className="text-sm space-y-1">
                                <p><strong>Precio Cierre:</strong> {latestCalculations.price}</p>
                                <p><strong>SMA10:</strong> {latestCalculations.sma10}</p>
                                <p><strong>SMA20:</strong> {latestCalculations.sma20}</p>
                                <p><strong>SMA50:</strong> {latestCalculations.sma50}</p>
                                <p><strong>MACD Line:</strong> {latestCalculations.macdLine}</p>
                                <p><strong>Signal Line:</strong> {latestCalculations.signalLine}</p>
                                <p><strong>Histograma MACD:</strong> {latestCalculations.macdHistogram}</p>
                                <p><strong>RSI:</strong> {latestCalculations.rsi}</p>
                                <p><strong>BB Superior:</strong> {latestCalculations.upperBB}</p>
                                <p><strong>BB Media:</strong> {latestCalculations.middleBB}</p>
                                <p><strong>BB Inferior:</strong> {latestCalculations.lowerBB}</p>
                            </div>
                        ) : (
                            <p>Cargando datos de indicadores...</p>
                        )}
                    </CardContent>
                </Card>

                {/* Contadores de Señales */}
                <Card className="shadow-lg border-blue-500">
                    <CardHeader>
                        <CardTitle className="text-lg">Conteo de Señales</CardTitle>
                        <CardDescription>Señales ejecutadas desde el inicio</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm space-y-1">
                            <li><strong>Buy:</strong> <span className="text-green-600 font-bold">{signalCount.buy}</span></li>
                            <li><strong>Sell:</strong> <span className="text-red-600 font-bold">{signalCount.sell}</span></li>
                            <li><strong>Hold:</strong> <span className="text-gray-600 font-bold">{signalCount.hold}</span></li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Contenido de la ScrollArea para el historial de precios y logs del bot */}
                <Card className="w-full max-w-7xl mt-4 shadow-lg rounded-xl">
                    <CardHeader>
                        <CardTitle>Historial de Precios y Logs</CardTitle>
                        <CardDescription>Datos de velas e indicadores de {selectedMarket?.symbol || 'N/A'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px] w-full pr-4">
                            {/* Renderiza los puntos de historial (velas), asegurando que el timestamp sea válido para la key */}
                            {annotatedHistory.slice().reverse().map(dp =>
                                isValidNumber(dp.timestamp) ? formatDataPoint(dp, selectedMarket?.pricePrecision || 2, selectedMarket?.precision.amount || 2) : null
                            )}
                            {/* Renderiza los logs de estrategia */}
                            {strategyLogs.slice().reverse().map((log, index) => (
                                <div key={`log-${index}`} className="text-xs text-blue-700 dark:text-blue-300 border-b border-gray-200 dark:border-gray-700 py-1 last:border-b-0">
                                    <p><strong>LOG [{new Date(log.timestamp).toLocaleTimeString()}]:</strong> {log.message}</p>
                                    {log.details && <pre className="text-[10px] text-blue-500 dark:text-blue-200 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>}
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>

            </div> {/* Cierre del grid principal */}

        </div> // Cierre del div principal min-h-screen
    );
}