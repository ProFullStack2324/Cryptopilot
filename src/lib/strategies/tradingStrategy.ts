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
    latestDataPoint: MarketPriceDataPoint;
    currentPrice: number;
    allBinanceBalances: BinanceBalance[];
    botOpenPosition: BotOpenPosition | null;
    selectedMarketRules: MarketRules;
}): StrategyDecision => {
    const {
        selectedMarket,
        latestDataPoint: latest,
        currentPrice,
        allBinanceBalances,
        botOpenPosition,
        selectedMarketRules,
    } = params;
    
    const isValidIndicator = (val: any): val is number => typeof val === 'number' && !isNaN(val);

    if (botOpenPosition) {
        // La lógica de venta/cierre ya se maneja en el hook principal,
        // por lo que si hay una posición abierta, la estrategia de entrada no debe hacer nada.
        return { action: 'hold' };
    }

    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, closePrice, buyConditionsMet } = latest;
    
    if (![rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, closePrice, buyConditionsMet].every(isValidIndicator)) {
        return { action: 'hold', details: { reason: "Indicadores inválidos en la última vela." } };
    }

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;

    let strategyMode: 'scalping' | 'sniper' | null = null;
    if (buyConditionsMet >= STRATEGY_CONFIG.sniper.minBuyConditions) {
        strategyMode = 'sniper';
    } else if (buyConditionsMet >= STRATEGY_CONFIG.scalping.minBuyConditions) {
        strategyMode = 'scalping';
    }
    
    if (strategyMode) {
        const config = STRATEGY_CONFIG[strategyMode];
        const decisionDetails = {
            strategyMode,
            requiredConditions: config.minBuyConditions,
            buyConditionsCount: buyConditionsMet,
            conditions: {
                price: closePrice <= lowerBollingerBand!,
                rsi: rsi! <= STRATEGY_CONFIG.rsiBuyThreshold,
                macd: macdHistogram! > (latest.macdHistogram! - (latest.macdHistogram! * 0.1)) && macdHistogram! > 0, // simplificado
            }
        };

        const minNotionalValue = selectedMarketRules.minNotional.minNotional;
        let amountInQuote = quoteAssetBalance * config.capitalToRiskPercentage;
        
        // Si el capital a arriesgar es menor que el mínimo nocional, se ajusta al mínimo.
        if (amountInQuote < minNotionalValue) {
            amountInQuote = minNotionalValue * 1.01; // Un poco por encima para evitar errores de redondeo.
        }

        // Si después de ajustar sigue sin haber fondos suficientes.
        if (amountInQuote > quoteAssetBalance) {
            const insufficientFundsDetails = { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance };
            return { action: 'hold_insufficient_funds', details: insufficientFundsDetails, orderData: { side: 'BUY', quantity: amountInQuote / currentPrice, price: currentPrice } };
        }

        let quantityToBuy = amountInQuote / currentPrice;
        const stepSize = selectedMarketRules.lotSize.stepSize;
        if (stepSize > 0) {
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
        }
        quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarketRules.precision.amount));
        
        // Verificar si la cantidad a comprar cumple el mínimo permitido por el exchange.
        if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
            return { action: 'hold', details: { ...decisionDetails, reason: `Cantidad a comprar (${quantityToBuy}) es menor que el mínimo permitido.` } };
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
    
    return { action: 'hold', details: { reason: "No se cumplieron las condiciones de compra." } };
};
    
