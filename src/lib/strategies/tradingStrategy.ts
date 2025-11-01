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

export interface StrategyDecision {
    action: TradeAction;
    orderData?: Omit<OrderFormData, 'marketId' | 'orderType' | 'symbol'> & { side: 'buy' | 'sell'; quantity: number };
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

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

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
    
    if (botOpenPosition) {
        // La lógica de venta ya se maneja en el hook principal (take profit, stop loss).
        // Por lo tanto, si hay una posición abierta, la estrategia de entrada no debe hacer nada.
        return { action: 'hold', details: { reason: "Posición ya abierta. Monitoreando para cierre." } };
    }

    const { buyConditionsMet, closePrice, lowerBollingerBand, rsi, macdHistogram } = latest;

    if (!isValidNumber(buyConditionsMet) || !isValidNumber(closePrice) || !isValidNumber(currentPrice)) {
        return { action: 'hold', details: { reason: "Datos de mercado o indicadores inválidos." } };
    }

    let strategyMode: 'scalping' | 'sniper' | null = null;
    if (buyConditionsMet >= STRATEGY_CONFIG.sniper.minBuyConditions) {
        strategyMode = 'sniper';
    } else if (buyConditionsMet >= STRATEGY_CONFIG.scalping.minBuyConditions) {
        strategyMode = 'scalping';
    }
    
    if (strategyMode) {
        const config = STRATEGY_CONFIG[strategyMode];
        const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;

        const decisionDetails = {
            strategyMode,
            requiredConditions: config.minBuyConditions,
            buyConditionsCount: buyConditionsMet,
            conditions: {
                price: isValidNumber(lowerBollingerBand) && closePrice <= lowerBollingerBand,
                rsi: isValidNumber(rsi) && rsi <= STRATEGY_CONFIG.rsiBuyThreshold,
                macd: isValidNumber(macdHistogram) && macdHistogram > 0,
            }
        };

        const minNotionalValue = selectedMarketRules.minNotional.minNotional;
        let amountInQuote = quoteAssetBalance * config.capitalToRiskPercentage;
        
        if (amountInQuote < minNotionalValue) {
            amountInQuote = minNotionalValue * 1.01; // Un poco por encima para evitar errores de redondeo.
        }

        if (amountInQuote > quoteAssetBalance) {
            const insufficientFundsDetails = { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance };
            const quantityForSimulation = amountInQuote / currentPrice;
            return { 
                action: 'hold_insufficient_funds', 
                details: insufficientFundsDetails, 
                orderData: { side: 'buy', quantity: quantityForSimulation, price: currentPrice } 
            };
        }

        let quantityToBuy = amountInQuote / currentPrice;
        const stepSize = selectedMarketRules.lotSize.stepSize;
        if (stepSize > 0) {
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
        }
        quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarketRules.precision.amount));
        
        if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
            return { action: 'hold', details: { ...decisionDetails, reason: `Cantidad a comprar (${quantityToBuy}) es menor que el mínimo permitido.` } };
        }

        return {
            action: 'buy',
            orderData: {
                side: 'buy',
                quantity: quantityToBuy,
                price: currentPrice
            },
            details: decisionDetails
        };
    }
    
    return { action: 'hold', details: { reason: "No se cumplieron las condiciones de compra para ninguna estrategia." } };
};
    
