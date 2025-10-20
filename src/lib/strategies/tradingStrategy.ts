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

export interface StrategyDecision {
    action: TradeAction;
    orderData?: OrderFormData;
    details?: any; // Para pasar información adicional, como el conteo de condiciones
}

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
        logStrategyMessage: log
    } = params;
    
    const MIN_REQUIRED_HISTORY = 30;

    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY) {
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const prev = currentMarketPriceHistory.at(-2);
    
    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram } = latest;
    const prevMacdHistogram = prev?.macdHistogram;

    const isValidIndicator = (val: any): val is number => typeof val === 'number' && !isNaN(val);

    if (![rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, prevMacdHistogram].every(isValidIndicator)) {
        return { action: 'hold' };
    }

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;
    const baseAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.baseAsset)?.free || 0;

    // --- LÓGICA DE VENTA (Si tenemos una posición abierta) ---
    if (botOpenPosition) {
        const takeProfitPriceCondition = currentPrice >= upperBollingerBand!;
        const takeProfitRsiCondition = rsi! >= 65;

        if (takeProfitPriceCondition || takeProfitRsiCondition) {
            let quantityToSell = botOpenPosition.amount;

            const stepSizeNum = selectedMarketRules.lotSize.stepSize;
            quantityToSell = Math.floor(quantityToSell / stepSizeNum) * stepSizeNum;
            // FIX: Corrected property access from selectedMarket.precision.amount to selectedMarket.amountPrecision
            quantityToSell = parseFloat(quantityToSell.toFixed(selectedMarket.amountPrecision));

            if (quantityToSell < selectedMarketRules.lotSize.minQty) {
                return { action: 'hold' };
            }
            return {
                action: 'sell',
                orderData: {
                    symbol: selectedMarket.symbol,
                    side: 'SELL',
                    orderType: 'MARKET',
                    quantity: quantityToSell,
                    price: currentPrice
                }
            };
        }
        return { action: 'hold' };
    }

    // --- LÓGICA DE COMPRA (Si NO tenemos posición abierta) ---
    else {
        const buyPriceCondition = currentPrice <= lowerBollingerBand!;
        const buyRsiCondition = rsi! <= 35;
        const buyMacdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0;
        
        const conditionsForBuyMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition];
        const buyConditionsCount = conditionsForBuyMet.filter(Boolean).length;
        
        const decisionDetails = {
            buyConditionsMet,
            buyConditionsCount,
            conditions: {
                price: buyPriceCondition,
                rsi: buyRsiCondition,
                macd: buyMacdCondition
            }
        };

        if (buyConditionsCount >= 2) {
            log(`Señal de COMPRA detectada.`, decisionDetails);
            
            const capitalToRisk = quoteAssetBalance * 0.95;
            let quantityToBuy = capitalToRisk / currentPrice;

            const minNotionalValue = selectedMarketRules.minNotional.minNotional;
            if (quantityToBuy * currentPrice < minNotionalValue) {
                if (quoteAssetBalance < minNotionalValue) {
                    log(`Fondos Insuficientes para nocional mínimo.`, { balance: quoteAssetBalance, minNotional: minNotionalValue });
                    return { action: 'hold', details: decisionDetails };
                }
                quantityToBuy = (minNotionalValue / currentPrice) * 1.01;
            }

            const stepSize = selectedMarketRules.lotSize.stepSize;
            if (stepSize > 0) {
                quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            }
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarket.amountPrecision));
            
            if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
                log(`Cantidad inválida tras ajuste.`, { quantityToBuy });
                return { action: 'hold', details: decisionDetails };
            }

            if (quantityToBuy * currentPrice > quoteAssetBalance) {
                log(`Fondos Insuficientes tras ajuste.`);
                return { action: 'hold', details: decisionDetails };
            }

            return {
                action: 'buy',
                orderData: {
                    symbol: selectedMarket.symbol,
                    side: 'BUY',
                    orderType: 'MARKET',
                    quantity: quantityToBuy,
                    price: currentPrice
                },
                details: decisionDetails
            };
        }
        
        return { action: 'hold', details: decisionDetails };
    }
};