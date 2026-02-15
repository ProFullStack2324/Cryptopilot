// src/lib/indicators.ts
import { MarketPriceDataPoint } from "./types";

/**
 * Calcula el Promedio Movil Simple (SMA).
 * @param prices Array de precios.
 * @param period Periodo de la SMA.
 * @returns El valor de la SMA o NaN si no hay suficientes datos.
 */
export const calculateSMA = (prices: number[], period: number): number => {
    if (prices.length < period) {
        return NaN;
    }
    const relevantPrices = prices.slice(-period); // Tomar los ultimos 'period' precios
    const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
};

/**
 * Calcula el Promedio Movil Exponencial (EMA).
 * @param prices Array de precios.
 * @param period Periodo de la EMA.
 * @param previousEMA EMA del periodo anterior (para calculo recursivo).
 * @returns El valor de la EMA o NaN si no hay suficientes datos.
 */
export const calculateEMA = (prices: number[], period: number, previousEMA?: number): number => {
    if (prices.length < period) {
        return NaN;
    }

    const multiplier = 2 / (period + 1);
    const relevantPrices = prices.slice(-period); // Tomar los ultimos 'period' precios

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
 * @param prices Array de precios (ultimos precios de MarketPriceDataPoint).
 * @returns Un objeto con macdLine, signalLine y macdHistogram o NaN si no hay suficientes datos.
 */
export const calculateMACD = (
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macdLine: number; signalLine: number; macdHistogram: number } => {
    // Asegurarse de tener suficientes datos para el calculo de todas las EMAs
    if (prices.length < slowPeriod + signalPeriod -1 ) { // Se necesita suficiente historial para la EMA mas lenta y la EMA de la senal
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

    // Calcular las series de EMA rapida y lenta sobre todo el historial disponible
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
 * Calcula el Indice de Fuerza Relativa (RSI).
 * @param prices Array de precios (ultimos precios de MarketPriceDataPoint).
 * @param period Periodo de la RSI (generalmente 14).
 * @returns El valor de la RSI o NaN si no hay suficientes datos.
 */
export const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) { // Necesitamos al menos period + 1 precios para calcular los cambios iniciales
        return NaN;
    }

    let gains: number[] = [];
    let losses: number[] = [];

    // Calcular las ganancias y perdidas por cambio de precio
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

    // Tomar solo los ultimos 'period' ganancias/perdidas para el calculo inicial de RS
    const relevantGains = gains.slice(-period);
    const relevantLosses = losses.slice(-period);

    let avgGain = calculateSMA(relevantGains, period);
    let avgLoss = calculateSMA(relevantLosses, period);

    if (isNaN(avgGain) || isNaN(avgLoss)) {
        return NaN;
    }

    const rs = avgLoss === 0 ? (avgGain > 0 ? Infinity : 0) : avgGain / avgLoss; // Manejar division por cero
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
};

/**
 * Calcula las Bandas de Bollinger.
 * @param prices Array de precios (ultimos precios de MarketPriceDataPoint).
 * @param period Periodo para la SMA (generalmente 20).
 * @param stdDevMultiplier Multiplicador de la desviacion estandar (generalmente 2).
 * @returns Un objeto con upper, middle y lower o NaN si no hay suficientes datos.
 */
export const calculateBollingerBands = (prices: number[], period: number = 20, stdDevMultiplier: number = 2): {
    upper: number;
    middle: number;
    lower: number;
} => {
    if (prices.length < period) {
        return { upper: NaN, middle: NaN, lower: NaN };
    }

    const relevantPrices = prices.slice(-period);
    const middleBand = calculateSMA(relevantPrices, period);
    if(isNaN(middleBand)){
        return { upper: NaN, middle: NaN, lower: NaN };
    }

    // Calcular la desviacion estandar
    const variance = relevantPrices.reduce((sum, price) => sum + Math.pow(price - middleBand, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upperBand = middleBand + (standardDeviation * stdDevMultiplier);
    const lowerBand = middleBand - (standardDeviation * stdDevMultiplier);

    return { upper: upperBand, middle: middleBand, lower: lowerBand };
};

/**
 * Calcula el Average True Range (ATR).
 * @param highs Array de precios altos.
 * @param lows Array de precios bajos.
 * @param closes Array de precios de cierre.
 * @param period Periodo del ATR (generalmente 14).
 * @returns El valor del ATR o NaN si no hay suficientes datos.
 */
export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
        return NaN;
    }

    // Necesitamos el cierre anterior para el TR, asi que empezamos desde el indice 1
    let trValues: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trValues.push(tr);
    }

    if (trValues.length < period) return NaN;

    // Wilder's Smoothing para ATR
    // Primer ATR es SMA del TR
    let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // ATR subsecuentes: ((Prior ATR * (period - 1)) + Current TR) / period
    for (let i = period; i < trValues.length; i++) {
        atr = ((atr * (period - 1)) + trValues[i]) / period;
    }

    return atr;
};

/**
 * Calcula el Average Directional Index (ADX).
 * @param highs Array de precios altos.
 * @param lows Array de precios bajos.
 * @param closes Array de precios de cierre.
 * @param period Periodo para DI y ADX (generalmente 14).
 * @returns El valor del ADX o NaN.
 */
export const calculateADX = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
    if (highs.length < 2 * period || lows.length < 2 * period || closes.length < 2 * period) {
        return NaN;
    }

    let plusDM: number[] = [];
    let minusDM: number[] = [];
    let trValues: number[] = [];

    for (let i = 1; i < closes.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];

        if (upMove > downMove && upMove > 0) {
            plusDM.push(upMove);
        } else {
            plusDM.push(0);
        }

        if (downMove > upMove && downMove > 0) {
            minusDM.push(downMove);
        } else {
            minusDM.push(0);
        }

        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trValues.push(tr);
    }

    // Helper para Wilder's Smoothing
    const wildersSmoothing = (values: number[], period: number): number[] => {
        let smoothed: number[] = [];
        
        // Primera suavizada = Suma de los primeros 'period' periodos (estandar Wilder para la inicial)
        let currentSmoothed = values.slice(0, period).reduce((a, b) => a + b, 0);
        smoothed.push(currentSmoothed);

        for (let i = period; i < values.length; i++) {
             // Previous - (Previous / period) + Current
             currentSmoothed = currentSmoothed - (currentSmoothed / period) + values[i];
             smoothed.push(currentSmoothed);
        }
        return smoothed;
    };

    const smoothedPlusDM = wildersSmoothing(plusDM, period);
    const smoothedMinusDM = wildersSmoothing(minusDM, period);
    const smoothedTR = wildersSmoothing(trValues, period);

    // Calcular DX
    let dxValues: number[] = [];
    const loopLength = Math.min(smoothedPlusDM.length, smoothedMinusDM.length, smoothedTR.length);

    for (let i = 0; i < loopLength; i++) {
        const tr = smoothedTR[i];
        if (tr === 0) {
            dxValues.push(0);
            continue;
        }
        const plusDI = (smoothedPlusDM[i] / tr) * 100;
        const minusDI = (smoothedMinusDM[i] / tr) * 100;

        const sumDI = plusDI + minusDI;
        if (sumDI === 0) {
            dxValues.push(0);
        } else {
            dxValues.push((Math.abs(plusDI - minusDI) / sumDI) * 100);
        }
    }

    // ADX es el suavizado del DX.
    if (dxValues.length < period) return NaN;

    // Primero: Promedio simple para el primer ADX
    let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Luego suavizar hasta el final
    for (let i = period; i < dxValues.length; i++) {
        adx = ((adx * (period - 1)) + dxValues[i]) / period;
    }

    return adx;
};
