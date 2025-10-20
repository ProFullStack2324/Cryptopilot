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

// ======================================================================================================
// CONFIGURACIÓN DE LA ESTRATEGIA DE SCALPING
// Estos son los parámetros que ajustaremos para cambiar el comportamiento del bot.
// ======================================================================================================
const SCALPING_CONFIG = {
    // 1. Requisito de Entrada (Compra): ¿Cuántas condiciones deben cumplirse para comprar?
    minBuyConditions: 1, // Scalping agresivo: 1 es suficiente.

    // 2. Umbrales de Indicadores: ¿Cuándo consideramos que un indicador da una señal?
    rsiBuyThreshold: 35,   // Comprar cuando RSI <= 35
    rsiSellThreshold: 65,  // Vender cuando RSI >= 65

    // 3 & 4. Take Profit y Stop Loss (se aplicarán en el hook `useTradingBot`)
    // No se usan directamente aquí, pero se definen para que el hook los lea.
    takeProfitPercentage: 0.008, // 0.8%
    stopLossPercentage: 0.004,   // 0.4%

    // 5. Gestión del Capital: ¿Qué porcentaje del capital arriesgar por operación?
    capitalToRiskPercentage: 0.95 // Usaremos un % alto (95%) porque lo ajustaremos al mínimo nocional.
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
        logStrategyMessage: log
    } = params;
    
    const MIN_REQUIRED_HISTORY = 30;

    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY) {
        log(`HOLD: Historial de mercado insuficiente (${currentMarketPriceHistory.length}/${MIN_REQUIRED_HISTORY}).`);
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
    
    // --- LÓGICA DE COMPRA (Si NO tenemos posición abierta) ---
    if (!botOpenPosition) {
        // Condiciones de compra para la estrategia de scalping
        const buyPriceCondition = closePrice <= lowerBollingerBand!;
        const buyRsiCondition = rsi! <= SCALPING_CONFIG.rsiBuyThreshold;
        const buyMacdCondition = macdHistogram! > 0 && prevMacdHistogram! <= 0;
        
        const conditionsForBuyMet = [buyPriceCondition, buyRsiCondition, buyMacdCondition];
        const buyConditionsCount = conditionsForBuyMet.filter(Boolean).length;
        
        const decisionDetails = {
            conditionsForBuyMet,
            buyConditionsCount,
            conditions: {
                price: buyPriceCondition,
                rsi: buyRsiCondition,
                macd: buyMacdCondition
            }
        };

        if (buyConditionsCount >= SCALPING_CONFIG.minBuyConditions) {
            log(`Señal de COMPRA detectada (${buyConditionsCount}/${SCALPING_CONFIG.minBuyConditions} condiciones cumplidas).`, decisionDetails);
            
            const minNotionalValue = selectedMarketRules.minNotional.minNotional;

            // Lógica de capital ajustada para scalping con saldos pequeños
            let amountInQuote = quoteAssetBalance * SCALPING_CONFIG.capitalToRiskPercentage;
            
            log(`Capital a arriesgar (${(SCALPING_CONFIG.capitalToRiskPercentage * 100).toFixed(0)}%): ${amountInQuote.toFixed(2)} ${selectedMarket.quoteAsset}. Nocional Mínimo: ${minNotionalValue} ${selectedMarket.quoteAsset}.`);

            // Si el capital a arriesgar es menor que el mínimo, intentamos usar el mínimo
            if (amountInQuote < minNotionalValue) {
                log(`Capital a arriesgar es menor que el mínimo. Se intentará usar el valor nocional mínimo.`);
                amountInQuote = minNotionalValue * 1.01; // Un 1% extra para cubrir fluctuaciones
            }

            // Comprobación final de saldo
            if (amountInQuote > quoteAssetBalance) {
                log(`HOLD: Saldo insuficiente (${quoteAssetBalance.toFixed(2)} ${selectedMarket.quoteAsset}) para cubrir la orden mínima de ${amountInQuote.toFixed(2)} ${selectedMarket.quoteAsset}.`);
                return { action: 'hold_insufficient_funds', details: { ...decisionDetails, required: amountInQuote, available: quoteAssetBalance } };
            }

            let quantityToBuy = amountInQuote / currentPrice;

            // Ajustar la cantidad a las reglas del mercado (stepSize y precision)
            const stepSize = selectedMarketRules.lotSize.stepSize;
            if (stepSize > 0) {
                quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            }
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarketRules.precision.amount));
            
            // Verificación final contra la cantidad mínima del lote
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
        // La decisión de vender por estrategia (take profit/stop loss) se manejará en useTradingBot
        // para tener acceso directo a la `botOpenPosition` y el `currentPrice`.
        // Esta función solo se preocupa de las señales de entrada.
        log("HOLD: Posición de compra ya abierta. Monitoreando para salida.");
        return { action: 'hold' };
    }
};
