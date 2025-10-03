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

// ----------------------------------------------------------------------------
// ESTRATEGIA DE SCALPING BASADA EN BANDAS DE BOLLINGER (BB) Y RSI
// ----------------------------------------------------------------------------
// Objetivo: Realizar operaciones rápidas basadas en la reversión a la media.
//
// Lógica de Compra:
// 1. El precio toca o cruza la Banda de Bollinger INFERIOR.
// 2. El RSI está en zona de SOBREVENTA (<= 35).
//    = Esto sugiere que el precio ha caído demasiado rápido y es probable un rebote.
//
// Lógica de Venta (Toma de Ganancias):
// 1. El precio toca o cruza la Banda de Bollinger SUPERIOR.
// 2. Opcional: El RSI entra en zona de SOBRECOMPRA (>= 65).
//    = Esto sugiere que el precio ha subido demasiado rápido y es un buen momento para tomar ganancias.
//
// Gestión de Capital:
// - Se usa un porcentaje fijo del capital disponible en USDT para cada compra.
// - Se asegura de que la orden CUMPLA con el `minNotional` (valor mínimo de la orden) de Binance.
//   Si el balance no es suficiente para la orden mínima, no se opera.
// ----------------------------------------------------------------------------

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
    
    const MIN_REQUIRED_HISTORY = 30; // Suficiente para BB(20) y RSI(14)

    // --- Guardias Iniciales ---
    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY) {
        log(`HOLD: Historial de velas insuficiente (${currentMarketPriceHistory.length}/${MIN_REQUIRED_HISTORY}).`);
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const { rsi, upperBollingerBand, lowerBollingerBand } = latest;

    if (rsi === undefined || upperBollingerBand === undefined || lowerBollingerBand === undefined) {
        log("HOLD: Indicadores (RSI, Bollinger Bands) no están disponibles en la última vela.");
        return { action: 'hold' };
    }

    log(`[SCALPING CHECK] P: ${currentPrice.toFixed(2)} | RSI: ${rsi.toFixed(2)} | BB Lower: ${lowerBollingerBand.toFixed(2)} | BB Upper: ${upperBollingerBand.toFixed(2)}`);

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;

    // --- LÓGICA DE VENTA (Si tenemos una posición abierta) ---
    if (botOpenPosition) {
        const takeProfitCondition = currentPrice >= upperBollingerBand;
        const rsiExitCondition = rsi >= 65;

        if (takeProfitCondition || rsiExitCondition) {
            log(`✅ VENTA: Condiciones de toma de ganancias cumplidas.`, { priceAtUpperBand: takeProfitCondition, rsiOverbought: rsiExitCondition });
            
            const quantityToSell = botOpenPosition.amount;
            // Validar si la cantidad a vender cumple con los mínimos de Binance
            if (quantityToSell < selectedMarketRules.lotSize.minQty) {
                log(`HOLD: La cantidad en posición (${quantityToSell}) es menor al mínimo vendible (${selectedMarketRules.lotSize.minQty}).`);
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
        log(`HOLD: Posición abierta, pero sin señal de venta.`);
        return { action: 'hold' };
    }

    // --- LÓGICA DE COMPRA (Si NO tenemos posición abierta) ---
    else {
        const buyCondition = currentPrice <= lowerBollingerBand;
        const rsiCondition = rsi <= 35;

        if (buyCondition && rsiCondition) {
            log(`✅ COMPRA: Condiciones cumplidas. Precio en BB inferior y RSI en sobreventa.`);

            // Calcular la cantidad a comprar usando un % del capital
            const capitalToRisk = quoteAssetBalance * 0.95; // Usar el 95% del capital disponible para tener margen
            let quantityToBuy = capitalToRisk / currentPrice;

            // 1. Validar contra minNotional (valor mínimo de la orden)
            const minNotional = selectedMarketRules.minNotional.minNotional;
            if (quantityToBuy * currentPrice < minNotional) {
                // Si nuestro capital disponible no alcanza para la orden mínima, no podemos operar.
                if (quoteAssetBalance < minNotional) {
                    log(`HOLD: Balance de ${selectedMarket.quoteAsset} (${quoteAssetBalance.toFixed(2)}) es insuficiente para la orden mínima de ${minNotional}.`);
                    return { action: 'hold' };
                }
                // Si tenemos suficiente capital pero el % es muy bajo, ajustamos la cantidad para que cumpla el mínimo.
                quantityToBuy = minNotional / currentPrice;
                log(`Ajustando cantidad para cumplir con minNotional. Nueva cantidad: ${quantityToBuy}`);
            }

            // 2. Ajustar la cantidad al `stepSize` del mercado (precisión de la cantidad)
            const stepSize = selectedMarketRules.lotSize.stepSize;
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarket.precision.amount));
            
            // 3. Verificación final de la cantidad
            if (quantityToBuy < selectedMarketRules.lotSize.minQty) {
                log(`HOLD: Cantidad a comprar (${quantityToBuy}) es menor al mínimo permitido (${selectedMarketRules.lotSize.minQty}) después de los ajustes.`);
                return { action: 'hold' };
            }

            if (quantityToBuy * currentPrice > quoteAssetBalance) {
                log(`HOLD: La cantidad final a comprar excede el balance disponible.`);
                return { action: 'hold' };
            }
            
            log(`Preparando orden de compra. Cantidad: ${quantityToBuy}`);
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

        log(`HOLD: Sin señal de compra.`);
        return { action: 'hold' };
    }
};
