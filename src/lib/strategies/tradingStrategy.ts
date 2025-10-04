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
// ESTRATEGIA DE SCALPING BASADA EN BANDAS DE BOLLINGER (BB) Y RSI (MODIFICADA)
// ----------------------------------------------------------------------------
// Objetivo: Ser más agresivo y reactivo a las condiciones del mercado.
//
// Lógica de Compra:
// 1. El precio toca o cruza la Banda de Bollinger INFERIOR.
// 2. Y el RSI está en zona de SOBREVENTA (<= 35).
//    = Las dos condiciones principales para una potencial reversión alcista.
//
// Lógica de Venta (Toma de Ganancias / Cierre):
// 1. El precio toca o cruza la Banda de Bollinger SUPERIOR.
// 2. O el RSI entra en zona de SOBRECOMPRA (>= 65).
//    = Cualquiera de estas dos condiciones es suficiente para cerrar la posición y asegurar ganancias.
//
// Gestión de Capital:
// - Se usa un porcentaje del capital disponible para cada compra.
// - Se asegura de que la orden CUMPLA con el `minNotional` de Binance.
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
    
    const MIN_REQUIRED_HISTORY = 30;

    if (currentMarketPriceHistory.length < MIN_REQUIRED_HISTORY) {
        log(`HOLD: Historial de velas insuficiente (${currentMarketPriceHistory.length}/${MIN_REQUIRED_HISTORY}).`);
        return { action: 'hold' };
    }

    const latest = currentMarketPriceHistory.at(-1)!;
    const prev = currentMarketPriceHistory.at(-2);
    
    const { rsi, upperBollingerBand, lowerBollingerBand, macdHistogram } = latest;
    const prevMacdHistogram = prev?.macdHistogram;

    if (rsi === undefined || upperBollingerBand === undefined || lowerBollingerBand === undefined || macdHistogram === undefined || prevMacdHistogram === undefined) {
        log("HOLD: Indicadores clave no disponibles en las últimas velas.");
        return { action: 'hold' };
    }

    log(`[SCALPING CHECK] P: ${currentPrice.toFixed(2)} | RSI: ${rsi.toFixed(2)} | BB Lower: ${lowerBollingerBand.toFixed(2)} | BB Upper: ${upperBollingerBand.toFixed(2)} | MACD Hist: ${macdHistogram.toFixed(4)}`);

    const quoteAssetBalance = allBinanceBalances.find(b => b.asset === selectedMarket.quoteAsset)?.free || 0;

    // --- LÓGICA DE VENTA (Si tenemos una posición abierta) ---
    if (botOpenPosition) {
        const takeProfitPriceCondition = currentPrice >= upperBollingerBand;
        const takeProfitRsiCondition = rsi >= 65;

        if (takeProfitPriceCondition || takeProfitRsiCondition) {
            log(`✅ VENTA: Condiciones de toma de ganancias cumplidas.`, { priceAtUpperBand: takeProfitPriceCondition, rsiOverbought: takeProfitRsiCondition });
            
            const quantityToSell = botOpenPosition.amount;
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
        const priceCondition = currentPrice <= lowerBollingerBand;
        const rsiCondition = rsi <= 35;
        // Condición MACD: el histograma acaba de cruzar a positivo o está creciendo.
        const macdCondition = macdHistogram > 0 && prevMacdHistogram <= 0;

        // Estrategia más agresiva: Se requieren 2 de 3 condiciones.
        const conditionsMet = [priceCondition, rsiCondition, macdCondition].filter(Boolean).length;

        if (conditionsMet >= 2) {
            log(`✅ COMPRA: ${conditionsMet}/3 condiciones cumplidas.`, { priceCondition, rsiCondition, macdCondition });

            const capitalToRisk = quoteAssetBalance * 0.95;
            let quantityToBuy = capitalToRisk / currentPrice;

            const minNotional = selectedMarketRules.minNotional.minNotional;
            if (quantityToBuy * currentPrice < minNotional) {
                if (quoteAssetBalance < minNotional) {
                    log(`HOLD: Balance de ${selectedMarket.quoteAsset} (${quoteAssetBalance.toFixed(2)}) es insuficiente para la orden mínima de ${minNotional}.`);
                    return { action: 'hold' };
                }
                quantityToBuy = minNotional / currentPrice;
                log(`Ajustando cantidad para cumplir con minNotional. Nueva cantidad: ${quantityToBuy}`);
            }

            const stepSize = selectedMarketRules.lotSize.stepSize;
            quantityToBuy = Math.floor(quantityToBuy / stepSize) * stepSize;
            quantityToBuy = parseFloat(quantityToBuy.toFixed(selectedMarket.precision.amount));
            
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

        log(`HOLD: Sin señal de compra (${conditionsMet}/3 condiciones cumplidas).`);
        return { action: 'hold' };
    }
};
