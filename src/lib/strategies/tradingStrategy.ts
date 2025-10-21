// r u t a   src/lib/strategies/tradingStrategy.ts
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

// ======================================================================================================
// CONFIGURACIÓN DE LAS ESTRATEGIAS
// ======================================================================================================
const STRATEGY_CONFIG = {
    scalping: {
        minBuyConditions: 1, // Scalping agresivo: 1 es suficiente.
        takeProfitPercentage: 0.008, // 0.8%
        stopLossPercentage: 0.004,   // 0.4%
        capitalToRiskPercentage: 0.95 // Usaremos un % alto porque se ajusta al mínimo nocional.
    },
    sniper: {
        minBuyConditions: 2, // Sniper conservador: requiere 2 o más.
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
    strategyMode: 'scalping' | 'sniper'; // Se añade el modo de estrategia
}): StrategyDecision => {
    const {
        selectedMarket,
        currentMarketPriceHistory,
        currentPrice,
        allBinanceBalances,
        botOpenPosition,
        selectedMarketRules,
        logStrategyMessage: log,
        strategyMode
    } = params;
    
    const MIN_REQUIRED_HISTORY = 30;

    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY) {
        log(`HOLD: Historial de mercado insuficiente (${currentMarketPriceHistory.length}/${MIN_REQUIRED_HISTORY}).`);
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const prev = currentMarketPriceHistory.at(-2);
    
    // Ahora la configuración se elige según el modo
    const config = STRATEGY_CONFIG[strategyMode];
    
    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, closePrice } = latest;
    const prevMacdHistogram = prev?.macdHistogram;

    const isValidIndicator = (val: any): val is number => typeof val === 'number' && !isNaN(val);

    if (![rsi, upperBollingerBand, lowerBollingerBand, macdHistogram, prevMacdHistogram, closePrice].every(isValidIndicator)) {
        log("HOLD: Uno o más indicadores clave son inválidos en la última vela.");
        return { action: 'hold' };
    }

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;
    
    // --- LÓGICA DE COMPRA (Si NO tenemos posición abierta) ---
    if (!botOpenPosition) {
        // Condiciones de compra (son las mismas, lo que cambia es cuántas se requieren)
        const buyPriceCondition = closePrice <= lowerBollingerBand!;
        const buyRsiCondition = rsi! <= STRATEGY_CONFIG.rsiBuyThreshold;
        const buyMacdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0;
        
        const conditionsForBuyMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition];
        const buyConditionsCount = conditionsForBuyMet.filter(Boolean).length;
        
        const decisionDetails = {
            strategyMode,
            requiredConditions: config.minBuyConditions,
            buyConditionsCount,
            conditions: {
                price: buyPriceCondition,
                rsi: buyRsiCondition,
                macd: buyMacdCondition
            }
        };

        if (buyConditionsCount >= config.minBuyConditions) {
            log(`Señal de COMPRA detectada en modo ${strategyMode} (${buyConditionsCount}/${config.minBuyConditions} condiciones cumplidas).`, decisionDetails);
            
            const minNotionalValue = selectedMarketRules.minNotional.minNotional;
            let amountInQuote = quoteAssetBalance * config.capitalToRiskPercentage;
            
            log(`Capital a arriesgar (${(config.capitalToRiskPercentage * 100).toFixed(0)}%): ${amountInQuote.toFixed(2)} ${selectedMarket.quoteAsset}. Nocional Mínimo: ${minNotionalValue} ${selectedMarket.quoteAsset}.`);

            if (amountInQuote < minNotionalValue) {
                log(`Capital a arriesgar es menor que el mínimo. Se intentará usar el valor nocional mínimo.`);
                amountInQuote = minNotionalValue * 1.01;
            }

            if (amountInQuote > quoteAssetBalance) {
                log(`HOLD: Saldo insuficiente (${quoteAssetBalance.toFixed(2)} ${selectedMarket.quoteAsset}) para cubrir la orden mínima de ${amountInQuote.toFixed(2)} ${selectedMarket.quoteAsset}.`);
                return { action: 'hold_insufficient_funds', details: { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance } };
            }

            let quantityToBuy = amountInQuote / currentPrice;

            const stepSize = selectedMarketRules.lotSize.stepSize;
            if (stepSize > 0) {
                quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            }
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarketRules.precision.amount));
            
            if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
                log(`HOLD: Cantidad a comprar (${quantityToBuy}) es menor que el mínimo permitido (${selectedMarketRules.lotSize.minQty}).`);
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
    // --- LÓGICA DE VENTA (Take Profit / Stop Loss, manejado en el hook) ---
    else {
        log(`HOLD en modo ${strategyMode}: Posición de compra ya abierta. Monitoreando para salida.`);
        return { action: 'hold' };
    }
};
