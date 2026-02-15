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
import { MIN_REQUIRED_HISTORY_FOR_BOT } from '@/hooks/useTradingBot';

export interface StrategyDecision {
    action: TradeAction;
    orderData?: Omit<OrderFormData, 'symbol' | 'orderType'> & { side: 'buy' | 'sell'; amount: number };
    details?: any; 
}

// ======================================================================================================
// CONFIGURACIÓN DE LAS ESTRATEGIAS (OPTIMIZADA - FILAS 3 Y 4)
// ======================================================================================================
const STRATEGY_CONFIG = {
    scalping: {
        minBuyConditions: 1, 
        takeProfitPercentage: 0.012, // 1.2% -> Garantiza ganancia neta tras fees (Fila 3)
        stopLossPercentage: 0.006,   // 0.6% -> Reduce pérdidas por ruido
        capitalToRiskPercentage: 0.95 
    },
    sniper: {
        minBuyConditions: 2, 
        takeProfitPercentage: 0.035, // 3.5% -> Busca movimientos institucionales (Fila 4)
        stopLossPercentage: 0.015,   // 1.5% -> Da espacio al precio para respirar
        capitalToRiskPercentage: 0.95
    },
    // Umbrales compartidos optimizados para producción (PnL Positivo)
    rsiBuyThreshold: 30, // Más exigente para evitar "fake covers"
    rsiSellThreshold: 70, 
    minVolumeMultiplier: 1.5,
    adxTrendThreshold: 28 // Evita mercados laterales con más fuerza
};

// Función auxiliar para calcular promedio de volumen
const calculateAverageVolume = (history: MarketPriceDataPoint[], periods: number = 20): number => {
    if (history.length < periods) return 0;
    const slice = history.slice(-periods);
    const sum = slice.reduce((acc, curr) => acc + (curr.volume || 0), 0);
    return sum / periods;
};

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
        logStrategyMessage: log,
    } = params;
    
    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY_FOR_BOT) {
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const prev = currentMarketPriceHistory.at(-2);
    
    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, closePrice, sma50, volume, adx, atr } = latest;
    const prevMacdHistogram = prev?.macdHistogram;

    const isValidIndicator = (val: any): val is number => typeof val === 'number' && !isNaN(val);

    // Validación crítica de indicadores (ahora incluyendo ADX)
    if (![rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, prevMacdHistogram, closePrice, sma50, adx, atr].every(isValidIndicator)) {
        log("HOLD: Indicadores insuficientes (ADX, ATR, SMA50, RSI... calculando).");
        return { action: 'hold' };
    }

    // --- NUEVO FILTRO DE RANGO (ADX) ---
    // Si ADX < 28, ignoramos operaciones (mercado lateral = pérdida de dinero por comisiones)
    if (adx! < STRATEGY_CONFIG.adxTrendThreshold) {
        log(`HOLD: Mercado lateral detectado (ADX: ${adx?.toFixed(2)} < ${STRATEGY_CONFIG.adxTrendThreshold}).`);
        return { action: 'hold' };
    }

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;
    
    if (botOpenPosition) {
        return { action: 'hold' };
    }

    // --- ANÁLISIS DE FILTROS AVANZADOS (FILAS 3 Y 4) ---
    
    // 1. Filtro de Tendencia (Para Scalping): El precio debe estar sobre la SMA 50
    const isUptrend = closePrice > sma50!; 

    // 2. Filtro de Volumen (Para Sniper)
    const avgVolume = calculateAverageVolume(currentMarketPriceHistory, 20);
    const hasVolumeSpike = (volume || 0) > (avgVolume * STRATEGY_CONFIG.minVolumeMultiplier);

    // --- CONDICIONES TÉCNICAS BÁSICAS ---
    const buyPriceCondition = closePrice <= lowerBollingerBand!;
    const buyRsiCondition = rsi! <= STRATEGY_CONFIG.rsiBuyThreshold;
    const buyMacdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0; // Cruce alcista
    
    const conditionsForBuyMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition];
    const buyConditionsCount = conditionsForBuyMet.filter(Boolean).length;

    let strategyMode: 'scalping' | 'sniper' | null = null;
    let reasonSkipped: string | null = null;

    // LÓGICA DE SELECCIÓN DE ESTRATEGIA
    if (buyConditionsCount >= STRATEGY_CONFIG.sniper.minBuyConditions) {
        if (hasVolumeSpike) {
            strategyMode = 'sniper';
        } else {
            reasonSkipped = "Condiciones Sniper cumplidas pero sin VOLUMEN suficiente.";
        }
    } else if (buyConditionsCount >= STRATEGY_CONFIG.scalping.minBuyConditions) {
        if (isUptrend) {
            strategyMode = 'scalping';
        } else {
            reasonSkipped = "Condiciones Scalping cumplidas pero sin TENDENCIA (Precio < SMA50).";
        }
    }

    // Log de filtrado
    if (!strategyMode && reasonSkipped) {
        log(`HOLD (Filtrado): ${reasonSkipped}`, { price: currentPrice, sma50, vol: volume, adx });
        return { action: 'hold' };
    }
    
    if (strategyMode) {
        const config = STRATEGY_CONFIG[strategyMode];
        
        // --- NIVELES DINÁMICOS BASADOS EN ATR (AJUSTADO) ---
        // Stop Loss: Usar el MAYOR entre el % base y 3*ATR. Queremos darle espacio.
        const atrValue = atr!;
        // Antes usábamos Math.min, lo que forzaba el stop más corto. Ahora usamos Math.max para seguridad.
        // Sniper config tiene SL 1.5%. 3*ATR en BTC (~250*3=750) es ~0.9%.
        // Entonces usaremos una base sólida:
        
        let multiplierSL = 3;
        let multiplierTP = 5; // Ratio > 1.5

        if (strategyMode === 'scalping') {
             multiplierSL = 2; // Más ajustado para scalping
             multiplierTP = 3;
        }

        const dynamicStopLossDist = Math.max(config.stopLossPercentage * closePrice, atrValue * multiplierSL);
        const dynamicTakeProfitDist = Math.max(config.takeProfitPercentage * closePrice, atrValue * multiplierTP);
        
        const slDistance = dynamicStopLossDist;
        const tpDistance = dynamicTakeProfitDist;

        const decisionDetails = {
            strategyMode,
            requiredConditions: config.minBuyConditions,
            buyConditionsCount,
            indicators: { 
                adx: adx?.toFixed(2),
                atr: atr?.toFixed(2),
                isUptrend, 
                hasVolumeSpike 
            },
            dynamicLevels: {
                sl_dist: slDistance.toFixed(selectedMarketRules.precision.price),
                tp_dist: tpDistance.toFixed(selectedMarketRules.precision.price)
            }
        };

        const minNotionalValue = selectedMarketRules.minNotional.minNotional;
        let amountInQuote = quoteAssetBalance * config.capitalToRiskPercentage;
        
        if (amountInQuote < minNotionalValue) {
            amountInQuote = minNotionalValue * 1.01; 
        }

        if (amountInQuote > quoteAssetBalance) {
            const insufficientFundsDetails = { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance };
            return { action: 'hold_insufficient_funds', details: insufficientFundsDetails, orderData: { side: 'buy', amount: amountInQuote / currentPrice, price: currentPrice } };
        }

        let amountToBuy = amountInQuote / currentPrice;

        // Ajuste de precisión (LOT_SIZE)
        const stepSize = selectedMarketRules.lotSize.stepSize;
        if (stepSize > 0) {
            amountToBuy = Math.floor(amountToBuy / stepSize) * stepSize;
        }
        amountToBuy = parseFloat(amountToBuy.toFixed(selectedMarketRules.precision.amount));
        
        if (amountToBuy < selectedMarketRules.lotSize.minQty) {
            log(`HOLD: Cantidad insuficiente (${amountToBuy}). Mínimo: ${selectedMarketRules.lotSize.minQty}`, decisionDetails);
            return { action: 'hold' };
        }

        return {
            action: 'buy',
            orderData: {
                side: 'buy',
                amount: amountToBuy,
                price: currentPrice
            },
            details: decisionDetails
        };
    }
    
    return { action: 'hold' };
};