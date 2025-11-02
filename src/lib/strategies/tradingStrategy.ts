// ru ta  src/lib/strategies/tradingStrategy.ts
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
    orderData?: Omit<OrderFormData, 'symbol' | 'orderType'> & { side: 'BUY' | 'SELL'; quantity: number };
    details?: any; 
}

// ======================================================================================================
// CONFIGURACIÓN DE LAS ESTRATEGIAS
// ======================================================================================================
const STRATEGY_CONFIG = {
    scalping: {
        minBuyConditions: 1, 
        takeProfitPercentage: 0.008, // 0.8%
        stopLossPercentage: 0.004,   // 0.4%
        capitalToRiskPercentage: 0.95 
    },
    sniper: {
        minBuyConditions: 2, 
        takeProfitPercentage: 0.02,  // 2%
        stopLossPercentage: 0.01,    // 1%
        capitalToRiskPercentage: 0.95
    },
    // Umbrales compartidos
    rsiBuyThreshold: 35,
    rsiSellThreshold: 65,
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
        // No registrar mensaje si no hay suficientes datos para evitar spam en el log inicial
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const prev = currentMarketPriceHistory.at(-2);
    
    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, closePrice } = latest;
    const prevMacdHistogram = prev?.macdHistogram;

    const isValidIndicator = (val: any): val is number => typeof val === 'number' && !isNaN(val);

    if (![rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, prevMacdHistogram, closePrice].every(isValidIndicator)) {
        log("HOLD: Uno o más indicadores clave son inválidos en la última vela.");
        return { action: 'hold' };
    }

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;
    
    if (botOpenPosition) {
        // No registrar mensaje aquí para evitar spam. El monitoreo de salida se hace en el hook.
        return { action: 'hold' };
    }

    // --- LÓGICA DE COMPRA DINÁMICA ---
    const buyPriceCondition = closePrice <= lowerBollingerBand!;
    const buyRsiCondition = rsi! <= STRATEGY_CONFIG.rsiBuyThreshold;
    const buyMacdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0;
    
    const conditionsForBuyMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition];
    const buyConditionsCount = conditionsForBuyMet.filter(Boolean).length;

    let strategyMode: 'scalping' | 'sniper' | null = null;
    if (buyConditionsCount >= STRATEGY_CONFIG.sniper.minBuyConditions) {
        strategyMode = 'sniper';
    } else if (buyConditionsCount >= STRATEGY_CONFIG.scalping.minBuyConditions) {
        strategyMode = 'scalping';
    }
    
    if (strategyMode) {
        const config = STRATEGY_CONFIG[strategyMode];
        const decisionDetails = {
            strategyMode,
            requiredConditions: config.minBuyConditions,
            buyConditionsCount,
            conditions: { price: buyPriceCondition, rsi: buyRsiCondition, macd: buyMacdCondition }
        };

        const minNotionalValue = selectedMarketRules.minNotional.minNotional;
        let amountInQuote = quoteAssetBalance * config.capitalToRiskPercentage;
        
        if (amountInQuote < minNotionalValue) {
            amountInQuote = minNotionalValue * 1.01;
        }

        if (amountInQuote > quoteAssetBalance) {
            const insufficientFundsDetails = { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance };
            // El mensaje de log se genera en el hook para este caso
            return { action: 'hold_insufficient_funds', details: insufficientFundsDetails, orderData: { side: 'BUY', quantity: amountInQuote / currentPrice, price: currentPrice } };
        }

        let quantityToBuy = amountInQuote / currentPrice;

        const stepSize = selectedMarketRules.lotSize.stepSize;
        if (stepSize > 0) {
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
        }
        quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarketRules.precision.amount));
        
        if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
            log(`HOLD: Cantidad a comprar (${quantityToBuy}) es menor que el mínimo permitido (${selectedMarketRules.lotSize.minQty}).`, decisionDetails);
            return { action: 'hold' };
        }

        return {
            action: 'buy',
            orderData: {
                side: 'BUY',
                quantity: quantityToBuy,
                price: currentPrice
            },
            details: decisionDetails
        };
    }
    
    // Si no se cumple ninguna condición de compra
    return { action: 'hold' };
};

    