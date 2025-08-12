// src/lib/indicators.ts
import { MarketPriceDataPoint } from "./types";

/**
 * Calcula el Promedio Móvil Simple (SMA).
 * @param prices Array de precios.
 * @param period Período de la SMA.
 * @returns El valor de la SMA o NaN si no hay suficientes datos.
 */
export const calculateSMA = (prices: number[], period: number): number => {
    if (prices.length < period) {
        return NaN;
    }
    const relevantPrices = prices.slice(-period); // Tomar los últimos 'period' precios
    const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
};

/**
 * Calcula el Promedio Móvil Exponencial (EMA).
 * @param prices Array de precios.
 * @param period Período de la EMA.
 * @param previousEMA EMA del período anterior (para cálculo recursivo).
 * @returns El valor de la EMA o NaN si no hay suficientes datos.
 */
export const calculateEMA = (prices: number[], period: number, previousEMA?: number): number => {
    if (prices.length < period) {
        return NaN;
    }

    const multiplier = 2 / (period + 1);
    const relevantPrices = prices.slice(-period); // Tomar los últimos 'period' precios

    if (previousEMA === undefined) {
        // Calcular la primera EMA como una SMA de los primeros 'period' precios
        const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
        return sum / period;
    } else {
        // Calcular EMA subsiguiente
        return (prices[prices.length - 1] - previousEMA) * multiplier + previousEMA;
    }
};

/**
 * Calcula MACD, Signal Line y MACD Histogram.
 * @param prices Array de precios (últimos precios de MarketPriceDataPoint).
 * @returns Un objeto con macdLine, signalLine y macdHistogram o NaN si no hay suficientes datos.
 */
export const calculateMACD = (
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macdLine: number; signalLine: number; macdHistogram: number } => {
    // Asegurarse de tener suficientes datos para el cálculo de todas las EMAs
    if (prices.length < slowPeriod + signalPeriod -1 ) { // Se necesita suficiente historial para la EMA más lenta y la EMA de la señal
        return { macdLine: NaN, signalLine: NaN, macdHistogram: NaN };
    }

    const calculateEMASeries = (data: number[], period: number): number[] => {
        const emas: number[] = [];
        if (data.length < period) return [];

        // Calcular la primera EMA como SMA de los primeros 'period' puntos
        emas.push(calculateSMA(data.slice(0, period), period));

        const multiplier = 2 / (period + 1);
        for (let i = period; i < data.length; i++) {
            const currentEMA = (data[i] - emas[emas.length - 1]) * multiplier + emas[emas.length - 1];
            emas.push(currentEMA);
        }
        return emas;
    };

    // Calcular las series de EMA rápida y lenta sobre todo el historial disponible
    const fastEMASeries = calculateEMASeries(prices, fastPeriod);
    const slowEMASeries = calculateEMASeries(prices, slowPeriod);

    // Asegurarse de que tenemos suficientes EMAs para calcular MACD
    if (fastEMASeries.length === 0 || slowEMASeries.length === 0) {
        return { macdLine: NaN, signalLine: NaN, macdHistogram: NaN };
    }

    // Calcular la serie de MACD Line
    const macdLineSeries: number[] = [];
    const minLength = Math.min(fastEMASeries.length, slowEMASeries.length);
    for (let i = 0; i < minLength; i++) {
        macdLineSeries.push(fastEMASeries[fastEMASeries.length - minLength + i] - slowEMASeries[slowEMASeries.length - minLength + i]);
    }

    // Asegurarse de que tenemos suficientes valores MACD para calcular la Signal Line
    if (macdLineSeries.length < signalPeriod) {
        return { macdLine: NaN, signalLine: NaN, macdHistogram: NaN };
    }

    // Calcular la serie de Signal Line (EMA de MACD Line)
    const signalLineSeries = calculateEMASeries(macdLineSeries, signalPeriod);

    if (signalLineSeries.length === 0) {
        return { macdLine: NaN, signalLine: NaN, macdHistogram: NaN };
    }

    const latestMACDLine = macdLineSeries[macdLineSeries.length - 1];
    const latestSignalLine = signalLineSeries[signalLineSeries.length - 1];
    const macdHistogram = latestMACDLine - latestSignalLine;

    return {
        macdLine: latestMACDLine,
        signalLine: latestSignalLine,
        macdHistogram: macdHistogram
    };
};

/**
 * Calcula el Índice de Fuerza Relativa (RSI).
 * @param prices Array de precios (últimos precios de MarketPriceDataPoint).
 * @param period Período de la RSI (generalmente 14).
 * @returns El valor de la RSI o NaN si no hay suficientes datos.
 */
export const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) { // Necesitamos al menos period + 1 precios para calcular los cambios iniciales
        return NaN;
    }

    let gains: number[] = [];
    let losses: number[] = [];

    // Calcular las ganancias y pérdidas por cambio de precio
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains.push(change);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(change));
        }
    }

    // Tomar solo los últimos 'period' ganancias/pérdidas para el cálculo inicial de RS
    const relevantGains = gains.slice(-period);
    const relevantLosses = losses.slice(-period);

    let avgGain = calculateSMA(relevantGains, period);
    let avgLoss = calculateSMA(relevantLosses, period);

    if (isNaN(avgGain) || isNaN(avgLoss)) {
        return NaN;
    }

    const rs = avgLoss === 0 ? (avgGain > 0 ? Infinity : 0) : avgGain / avgLoss; // Manejar división por cero
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
};

/**
 * Calcula las Bandas de Bollinger.
 * @param prices Array de precios (últimos precios de MarketPriceDataPoint).
 * @param period Período para la SMA (generalmente 20).
 * @param stdDevMultiplier Multiplicador de la desviación estándar (generalmente 2).
 * @returns Un objeto con upperBollingerBand, middleBollingerBand y lowerBollingerBand o NaN si no hay suficientes datos.
 */
export const calculateBollingerBands = (prices: number[], period: number = 20, stdDevMultiplier: number = 2): {
    upperBollingerBand: number;
    middleBollingerBand: number;
    lowerBollingerBand: number;
} => {
    if (prices.length < period) {
        return { upperBollingerBand: NaN, middleBollingerBand: NaN, lowerBollingerBand: NaN };
    }

    const relevantPrices = prices.slice(-period);
    const middleBand = calculateSMA(relevantPrices, period);

    // Calcular la desviación estándar
    const variance = relevantPrices.reduce((sum, price) => sum + Math.pow(price - middleBand, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upperBand = middleBand + (standardDeviation * stdDevMultiplier);
    const lowerBand = middleBand - (standardDeviation * stdDevMultiplier);

    return { upperBollingerBand: upperBand, middleBollingerBand: middleBand, lowerBollingerBand: lowerBand };
};