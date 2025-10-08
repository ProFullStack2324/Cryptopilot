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

    // --- LÓGICA DE VENTA (Si tenemos una posición abierta) ---
    if (botOpenPosition) {
        const takeProfitPriceCondition = currentPrice >= upperBollingerBand!;
        const takeProfitRsiCondition = rsi! >= 65;

        if (takeProfitPriceCondition || takeProfitRsiCondition) {
            const quantityToSell = botOpenPosition.amount;
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
        const priceCondition = currentPrice <= lowerBollingerBand!;
        const rsiCondition = rsi! <= 35;
        const macdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0;
        const conditionsMet = [priceCondition, rsiCondition, macdCondition].filter(Boolean).length;
        
        // La acción es BUY si se cumplen las condiciones, independientemente del saldo.
        if (conditionsMet >= 2) {
            log(`Señal de COMPRA detectada.`, { priceCondition, rsiCondition, macdCondition });
            
            // Ahora, validamos si se puede ejecutar la orden con el saldo disponible
            const capitalToRisk = quoteAssetBalance * 0.95; // Usar el 95% del capital
            let quantityToBuy = capitalToRisk / currentPrice;

            const minNotional = selectedMarketRules.minNotional.minNotional;
            if (quantityToBuy * currentPrice < minNotional) {
                if (quoteAssetBalance < minNotional) {
                    log(`Fondos Insuficientes: Balance de ${selectedMarket.quoteAsset} (${quoteAssetBalance.toFixed(2)}) es menor que el nocional mínimo (${minNotional}).`, { balance: quoteAssetBalance, minNotional });
                    return { action: 'hold' }; // No se puede ni ajustar, se queda en HOLD
                }
                quantityToBuy = minNotional / currentPrice * 1.01; // Ajustar para asegurar que supera el mínimo
            }

            const stepSize = selectedMarketRules.lotSize.stepSize;
            if (stepSize > 0) {
                quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            }
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarket.precision.amount));
            
            if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
                log(`Cantidad Inválida: La cantidad calculada (${quantityToBuy}) es menor al mínimo permitido (${selectedMarketRules.lotSize.minQty}).`);
                return { action: 'hold' };
            }

            if (quantityToBuy * currentPrice > quoteAssetBalance) {
                log(`Fondos Insuficientes: La cantidad final a comprar (${quantityToBuy}) excede el balance disponible.`);
                return { action: 'hold' };
            }

            // Si todas las validaciones de saldo y cantidad pasan, se crea la orden
            return {
                action: 'buy',
                orderData: {
                    symbol: selectedMarket.symbol,
                    side: 'BUY',
                    orderType: 'MARKET',
                    quantity: quantityToBuy,
                    price: currentPrice
                }
            };
        }
        return { action: 'hold' };
    }
};

    