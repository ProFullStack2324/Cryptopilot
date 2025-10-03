// src/lib/strategies/tradingStrategy.ts
import {
    Market,
    MarketRules,
    BinanceBalance,
    BotOpenPosition,
    TradeAction,
    OrderFormData,
    MarketPriceDataPoint
} from '@/lib/types';
// Asegúrate de que calculateBollingerBands esté importado correctamente desde '@/lib/indicators'
import { calculateSMA, calculateMACD, calculateRSI, calculateBollingerBands } from '@/lib/indicators'; 

export interface StrategyDecision {
    action: TradeAction;
    orderData?: OrderFormData;
}

// ⏱️ Variable global en este archivo (para el cooldown)
// CAMBIO CLAVE 1: Cooldown de 30 segundos para permitir operaciones de scalping frecuentes.
// Esto evita el spam de órdenes y permite que el bot reaccione a movimientos rápidos.
let lastActionTimestamp: number | null = null;
const COOLDOWN_MS = 30 * 1000; // 30 segundos de cooldown entre acciones de trading

export const decideTradeActionAndAmount = (params: {
    selectedMarket: Market;
    currentMarketPriceHistory: MarketPriceDataPoint[];
    currentPrice: number;
    allBinanceBalances: BinanceBalance[];
    botOpenPosition: BotOpenPosition | null;
    selectedMarketRules: MarketRules;
    logStrategyMessage: (message: string, details?: any) => void;
}): StrategyDecision => {
    const {
        selectedMarket,
        currentMarketPriceHistory,
        currentPrice,
        allBinanceBalances,
        botOpenPosition,
        selectedMarketRules,
        logStrategyMessage
    } = params;

    const log = logStrategyMessage;
    // CAMBIO CLAVE 2: Mínimo de velas requeridas para el cálculo de indicadores.
    // Se mantiene en 51 para asegurar que todos los indicadores (especialmente Bandas de Bollinger y MACD)
    // tengan suficientes datos para un cálculo preciso.
    const MIN_REQUIRED_HISTORY_FOR_INDICATORS = 51; 

    log(`[STRATEGY ENTRY] Función llamada. Longitud del historial: ${currentMarketPriceHistory.length}, Precio actual: ${currentPrice}`);


    log(`[Strategy] Iniciando ciclo de decisión. Velas disponibles: ${currentMarketPriceHistory.length}`);

    // --- Primeras guardias para datos básicos ---
    // Si falta información fundamental, el bot no puede operar.
    if (!selectedMarket || currentPrice === null || !selectedMarketRules || currentMarketPriceHistory.length === 0) {
        log(`HOLD: Datos insuficientes o incompletos para decidir la estrategia. selectedMarket: ${!!selectedMarket}, currentPrice: ${currentPrice !== null}, selectedMarketRules: ${!!selectedMarketRules}, historyLength: ${currentMarketPriceHistory.length}`);
        return { action: 'hold' };
    }

    // Si no hay suficientes velas para calcular los indicadores, el bot espera.
    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY_FOR_INDICATORS) {
        log(`HOLD: Historial insuficiente (${currentMarketPriceHistory.length}/${MIN_REQUIRED_HISTORY_FOR_INDICATORS}). Se requiere más data para calcular indicadores.`);
        return { action: 'hold' };
    }

    // Obtener la última vela y la anterior para análisis de cruces e indicadores.
    const latest = currentMarketPriceHistory.at(-1)!;
    const previous = currentMarketPriceHistory.at(-2);

    // Logs de depuración para inspeccionar los indicadores de las últimas velas.
    log("DEBUG INDICATORS CHECK (Before strict check):", {
        latestRSI: latest.rsi,
        latestSMA10: latest.sma10,
        latestSMA20: latest.sma20,
        latestSMA50: latest.sma50, 
        latestMACDLine: latest.macdLine,
        latestSignalLine: latest.signalLine,
        latestMACDHist: latest.macdHistogram,
        latestUpperBB: latest.upperBollingerBand, 
        latestMiddleBB: latest.middleBollingerBand,
        latestLowerBB: latest.lowerBollingerBand,
        previousExists: !!previous,
        previousRSI: previous?.rsi,
        previousSMA10: previous?.sma10,
        previousSMA20: previous?.sma20,
        previousSMA50: previous?.sma50, 
        previousMACDLine: previous?.macdLine,
        previousSignalLine: previous?.signalLine,
        previousMACDHist: previous?.macdHistogram,
        previousUpperBB: previous?.upperBollingerBand, 
        previousMiddleBB: previous?.middleBollingerBand,
        previousLowerBB: previous?.lowerBollingerBand,
    });


    // CAMBIO CLAVE 3: Verificación Completa de Indicadores en las Últimas Velas.
    // Asegura que todos los indicadores necesarios estén calculados y sean válidos (no undefined/NaN)
    // en las últimas *dos* velas, ya que se usan para detectar cruces y cambios de momentum.
    const indicatorsOK = latest.rsi !== undefined &&
                             latest.sma10 !== undefined &&
                             latest.sma20 !== undefined &&
                             latest.sma50 !== undefined && 
                             latest.macdLine !== undefined &&
                             latest.signalLine !== undefined &&
                             latest.macdHistogram !== undefined &&
                             latest.upperBollingerBand !== undefined && 
                             latest.middleBollingerBand !== undefined &&
                             latest.lowerBollingerBand !== undefined &&
                             previous?.rsi !== undefined &&
                             previous?.sma10 !== undefined &&
                             previous?.sma20 !== undefined &&
                             previous?.sma50 !== undefined && 
                             previous?.macdLine !== undefined &&
                             previous?.signalLine !== undefined &&
                             previous?.macdHistogram !== undefined &&
                             previous?.upperBollingerBand !== undefined && 
                             previous?.middleBollingerBand !== undefined &&
                             previous?.lowerBollingerBand !== undefined;
    
    if (!indicatorsOK) {
        log(`HOLD: Indicadores incompletos en las últimas velas. Deteniendo estrategia aquí.`);
        return { action: 'hold' };
    }

    // CAMBIO CLAVE 4: Cooldown de la Estrategia.
    // Si una acción de trading se realizó recientemente (hace menos de COOLDOWN_MS),
    // el bot esperará para evitar operaciones excesivamente rápidas, dando tiempo al mercado
    // para reaccionar a la orden anterior y evitar sobre-trading.
    if (lastActionTimestamp && Date.now() - lastActionTimestamp < COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((COOLDOWN_MS - (Date.now() - lastActionTimestamp)) / 1000);
        log(`HOLD: Cooldown de ${remainingCooldown} segundos activo desde la última acción.`);
        return { action: 'hold' };
    }

    const volumes = currentMarketPriceHistory.map(d => d.volume);
    const volumeSMA20 = volumes.length >= 20 ? calculateSMA(volumes, 20) : 0;

    const baseBalance = allBinanceBalances.find(b => b.asset === selectedMarket.baseAsset)?.free || 0;
    const quoteBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;

    let action: TradeAction = 'hold';
    let tradeQuantity = 0;

    log(`[Strategy - Balances] Activo Base (${selectedMarket.baseAsset}): ${baseBalance}, Activo de Cotización (${selectedMarket.quoteAsset}): ${quoteBalance}`);
    log(`[Strategy - Precios/Indicadores] Precio Actual: ${currentPrice.toFixed(selectedMarket.pricePrecision)}, RSI: ${latest.rsi?.toFixed(2)}, SMA10: ${latest.sma10?.toFixed(selectedMarket.pricePrecision)}, SMA20: ${latest.sma20?.toFixed(selectedMarket.pricePrecision)}, SMA50: ${latest.sma50?.toFixed(selectedMarket.pricePrecision)}, MACDLine: ${latest.macdLine?.toFixed(selectedMarket.pricePrecision)}, SignalLine: ${latest.signalLine?.toFixed(selectedMarket.pricePrecision)}, MACDHist: ${latest.macdHistogram?.toFixed(selectedMarket.pricePrecision)}, UpperBB: ${latest.upperBollingerBand?.toFixed(selectedMarket.pricePrecision)}, MiddleBB: ${latest.middleBollingerBand?.toFixed(selectedMarket.pricePrecision)}, LowerBB: ${latest.lowerBollingerBand?.toFixed(selectedMarket.pricePrecision)}, Volumen: ${latest.volume?.toFixed(2)}, VolumenSMA20: ${volumeSMA20.toFixed(2)}`);


    // ==================================================================================================
    // Lógica de Venta (si ya hay una posición abierta)
    // ==================================================================================================
    if (botOpenPosition) {
        log("EVALUANDO VENTA: Posición abierta detectada.");

        // CAMBIO CLAVE 5: Condición de VENTA - Precio en Banda de Bollinger Superior.
        // Una señal de venta agresiva para scalping es cuando el precio toca o cruza la banda superior,
        // indicando una posible reversión a la baja o un punto de sobrecompra temporal.
        const priceAtUpperBB = currentPrice >= latest.upperBollingerBand!;

        // Condición para cruce de SMA: SMA10 cruza por debajo de SMA20 (confirmación bajista).
        // Esto es una señal más lenta, usada como "condición fuerte" adicional.
        const cruceSMABaja = latest.sma10! < latest.sma20! && previous!.sma10! >= previous!.sma20!;
        
        // CAMBIO CLAVE 6: MACD Histograma Disminuyendo para Venta (Scalping).
        // Este es un indicador de momentum más rápido. Si el histograma está disminuyendo,
        // sugiere que el impulso alcista se está debilitando o el bajista está ganando fuerza,
        // lo que es una señal temprana de venta.
        const macdHistFalling = typeof latest.macdHistogram === 'number' && typeof previous?.macdHistogram === 'number' && latest.macdHistogram < previous.macdHistogram;
        
        log(`DEBUG VENTA: MACD Histograma (Latest: ${latest.macdHistogram?.toFixed(selectedMarket.pricePrecision)}, Previous: ${previous?.macdHistogram?.toFixed(selectedMarket.pricePrecision)})`, { macdHistFalling });

        // CAMBIO CLAVE 7: RSI Relajado para Venta (Scalping).
        // El RSI ya no necesita estar muy alto para vender. Un valor por encima de 30 es suficiente
        // para indicar que el activo no está "sobrevendido" y que hay espacio para una venta rápida,
        // sin esperar condiciones extremas.
        const rsiOKVenta = latest.rsi! > 30; 

        log("Condiciones de VENTA Evaluadas:", {
            priceAtUpperBB,
            cruceSMABaja,
            macdHistFalling, 
            rsiOKVenta: latest.rsi,
            botOpenPositionAmount: botOpenPosition.amount
        });

        // CAMBIO CLAVE 8: Combinación de Condiciones Mínimas para Venta Rápida.
        // Se prioriza la combinación de la Banda de Bollinger Superior, el Histograma MACD bajista
        // y un RSI no sobrevendido para generar señales de venta frecuentes y rápidas.
        const condicionesMinimasVenta = priceAtUpperBB && macdHistFalling && rsiOKVenta;
        const condicionesFuertesVenta = condicionesMinimasVenta && cruceSMABaja; // SMA como confirmación adicional

        if (condicionesMinimasVenta) {
            action = 'sell';
            let qty = botOpenPosition.amount;
            const step = selectedMarketRules.lotSize.stepSize;
            qty = Math.floor(qty / step) * step;
            qty = parseFloat(qty.toFixed(selectedMarket.precision.amount));

            if (qty <= 0 || qty < selectedMarketRules.lotSize.minQty) {
                log("HOLD: Cantidad de venta inválida o insuficiente después de ajuste de precisión.", { qty, minQty: selectedMarketRules.lotSize.minQty });
                return { action: 'hold' };
            }

            if (baseBalance < qty) {
                log(`HOLD: Balance base insuficiente para vender. Requerido: ${qty} ${selectedMarket.baseAsset}, Disponible: ${baseBalance} ${selectedMarket.baseAsset}.`);
                return { action: 'hold' };
            }

            tradeQuantity = qty;

            if (condicionesFuertesVenta) {
                log("✅ Señal de VENTA FUERTE confirmada (BB superior, MACD Histograma bajista, RSI, y cruceSMA bajista).", { qty });
            } else {
                log("⚠️ Señal de VENTA moderada (BB superior, MACD Histograma bajista, RSI).", { qty });
            }
        } else {
            log("HOLD: No se cumplen condiciones mínimas para venta (BB superior, MACD Histograma bajista, RSI no sobrevendido).");
            return { action: 'hold' };
        }
    } else {
        // ==================================================================================================
        // Lógica de Compra (si no hay posición abierta)
        // ==================================================================================================
        log("EVALUANDO COMPRA: No hay posición abierta.");

        // CAMBIO CLAVE 9: Condición de COMPRA - Precio en Banda de Bollinger Inferior.
        // Una señal de compra agresiva para scalping es cuando el precio toca o cruza la banda inferior,
        // indicando una posible reversión al alza o un punto de sobreventa temporal.
        const priceAtLowerBB = currentPrice <= latest.lowerBollingerBand!;
        
        // Condición para cruce de SMA: SMA10 cruza por encima de SMA20 (confirmación alcista).
        // Esto es una señal más lenta, usada como "condición fuerte" adicional.
        const cruceSMAAlta = latest.sma10! > latest.sma20! && previous!.sma10! <= previous!.sma20!;
        
        // CAMBIO CLAVE 10: MACD Histograma Aumentando para Compra (Scalping).
        // Este es un indicador de momentum más rápido. Si el histograma está aumentando,
        // sugiere que el impulso bajista se está debilitando o el alcista está ganando fuerza,
        // lo que es una señal temprana de compra.
        const macdHistRising = typeof latest.macdHistogram === 'number' && typeof previous?.macdHistogram === 'number' && latest.macdHistogram > previous.macdHistogram;
        
        log(`DEBUG COMPRA: MACD Histograma (Latest: ${latest.macdHistogram?.toFixed(selectedMarket.pricePrecision)}, Previous: ${previous?.macdHistogram?.toFixed(selectedMarket.pricePrecision)})`, { macdHistRising });

        // CAMBIO CLAVE 11: RSI Relajado para Compra (Scalping).
        // El RSI ya no necesita estar muy bajo para comprar. Un valor por debajo de 70 es suficiente
        // para indicar que el activo no está "sobrecomprado" y que hay espacio para una compra rápida,
        // sin esperar condiciones extremas.
        const rsiOKCompra = latest.rsi! < 70;

        log("Condiciones de COMPRA Evaluadas:", {
            priceAtLowerBB,
            cruceSMAAlta,
            macdHistRising, 
            rsiOKCompra: latest.rsi
        });

        // CAMBIO CLAVE 12: Combinación de Condiciones Mínimas para Compra Rápida.
        // Se prioriza la combinación de la Banda de Bollinger Inferior, el Histograma MACD alcista
        // y un RSI no sobrecomprado para generar señales de compra frecuentes y rápidas.
        const condicionesMinimasCompra = priceAtLowerBB && macdHistRising && rsiOKCompra;
        const condicionesFuertesCompra = condicionesMinimasCompra && cruceSMAAlta; // SMA como confirmación adicional

        if (condicionesMinimasCompra) {
            action = 'buy';
            const percentageOfCapitalToUse = 0.05; // Usar un 5% del capital disponible
            let capitalToUse = quoteBalance * percentageOfCapitalToUse;

            if (capitalToUse <= 0) {
                log("HOLD: Balance insuficiente en moneda de cotización para comprar.", { quoteBalance });
                return { action: 'hold' };
            }

            let qty = capitalToUse / currentPrice;
            const step = selectedMarketRules.lotSize.stepSize;
            qty = Math.floor(qty / step) * step;
            qty = parseFloat(qty.toFixed(selectedMarket.precision.amount));

            const notional = qty * currentPrice;
            const minNotional = selectedMarketRules.minNotional.minNotional;

            if (notional < minNotional) {
                let adjustedQty = (minNotional / currentPrice);
                adjustedQty = Math.ceil(adjustedQty / step) * step;
                adjustedQty = parseFloat(adjustedQty.toFixed(selectedMarket.precision.amount));

                if (adjustedQty * currentPrice > quoteBalance) {
                    log(`HOLD: Ajuste a minNotional (${minNotional}) excede balance disponible. Capital para orden: ${adjustedQty * currentPrice}, Disponible: ${quoteBalance}.`);
                    return { action: 'hold' };
                }
                if (adjustedQty <= 0) {
                    log("HOLD: Cantidad ajustada a minNotional es cero o negativa. No se puede comprar.");
                    return { action: 'hold' };
                }
                qty = adjustedQty;
                log(`[Strategy] Cantidad ajustada a minNotional para comprar: ${qty} ${selectedMarket.baseAsset}`);
            }

            if (qty <= 0) {
                log("HOLD: Cantidad de compra inválida o cero después de todos los ajustes.", { qty });
                return { action: 'hold' };
            }

            tradeQuantity = qty;

            if (condicionesFuertesCompra) {
                log("✅ Señal de COMPRA FUERTE confirmada (BB inferior, MACD Histograma alcista, RSI, y cruceSMA alcista).", { qty });
            } else {
                log("⚠️ Señal de COMPRA moderada (BB inferior, MACD Histograma alcista, RSI).", { qty });
            }
        } else {
            log("HOLD: No se cumplen condiciones mínimas para compra (BB inferior, MACD Histograma alcista, RSI sobrevendido).");
            return { action: 'hold' };
        }
    }

    if ((action === 'buy' || action === 'sell') && tradeQuantity > 0) {
        const orderData: OrderFormData = {
            symbol: selectedMarket.symbol,
            side: action.toUpperCase() as 'BUY' | 'SELL',
            orderType: 'MARKET',
            quantity: tradeQuantity,
            price: currentPrice,
        };

        // CAMBIO CLAVE 13: Actualizar Timestamp de Última Acción.
        // Esto activa el cooldown de 30 segundos, impidiendo que el bot opere de nuevo inmediatamente.
        lastActionTimestamp = Date.now();
        
        log(`🚀 EJECUCIÓN: ${action.toUpperCase()} ${tradeQuantity.toFixed(selectedMarket.precision.amount)} ${selectedMarket.baseAsset} @ ${currentPrice?.toFixed(selectedMarket.pricePrecision)} ${selectedMarket.quoteAsset}`, { orderData });
        return { action, orderData };
    }

    log("HOLD: No se ejecuta acción final (ninguna condición de BUY/SELL se cumplió o la cantidad es cero).");
    return { action: 'hold' };
};
