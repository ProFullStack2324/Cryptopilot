
/**
 * Calcula el True Range (TR).
 */
const calculateTR = (high: number, low: number, receivedClose: number): number => {
    return Math.max(
        high - low,
        Math.abs(high - receivedClose),
        Math.abs(low - receivedClose)
    );
};

/**
 * Calcula el Average True Range (ATR).
 * @param highs Array de precios altos.
 * @param lows Array de precios bajos.
 * @param closes Array de precios de cierre.
 * @param period Período del ATR (generalmente 14).
 * @returns El valor del ATR o NaN si no hay suficientes datos.
 */
export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14): number => {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
        return NaN;
    }

    // Necesitamos el cierre anterior para el TR, así que empezamos desde el índice 1
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
 * @param period Período para DI y ADX (generalmente 14).
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
        let initialSum = values.slice(0, period).reduce((a, b) => a + b, 0);
        smoothed.push(initialSum); // Suma inicial, no promedio, según algunas definiciones, pero Wilder usa primera media luego smooth. 
        // Corrección: Wilder usa SMA para el primero, luego smooth. 
        // Usaremos la lógica estándar: Primera = Suma(Primeros N) (luego se normaliza al dividir por TR)
        // Ojo: Para +DI y -DI, se suavizan +DM, -DM y TR.
        
        // Primera suavizada = Suma de los primeros 'period' periodos
        let currentSmoothed = values.slice(0, period).reduce((a, b) => a + b, 0);
        smoothed.push(currentSmoothed); // Ojo: esto alinea con el índice 'period-1' del input (si fuera array paralelo)

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

    // ADX es la SMA (o Wilder smooth) del DX. Generalmente SMA del DX para simplificar o Wilder.
    // Usaremos Wilder's technique: Primera ADX es promedio de DX de 'period' periodos.
    if (dxValues.length < period) return NaN;

    // Calcular el último ADX disponible
    // ADX = ((Prior ADX * (period - 1)) + Current DX) / period
    
    // Primero: SMA simple para el primer ADX
    let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Luego suavizar hasta el final
    for (let i = period; i < dxValues.length; i++) {
        adx = ((adx * (period - 1)) + dxValues[i]) / period;
    }

    return adx;
};
