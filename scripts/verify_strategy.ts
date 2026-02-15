
import ccxt from 'ccxt';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR, calculateADX } from '../src/lib/indicators';
import { MarketPriceDataPoint, BotOpenPosition } from '../src/lib/types';
import { decideTradeActionAndAmount } from '../src/lib/strategies/tradingStrategy';

// Mock minimal objects for the strategy function
const mockMarket = {
    id: 'BTCUSDT',
    symbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    active: true,
    pricePrecision: 2,
    amountPrecision: 5,
    precision: { amount: 5, price: 2, base: 8, quote: 8 },
    limits: { amount: { min: 0.00001, max: 9000 }, price: { min: 0.01, max: 1000000 }, cost: { min: 5 } },
    info: {},
    latestPrice: 0,
    change24h: 0
};

const mockMarketRules = {
    symbol: 'BTCUSDT',
    status: 'TRADING',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    baseAssetPrecision: 8,
    quotePrecision: 8,
    icebergAllowed: true,
    ocoAllowed: true,
    quoteOrderQtyMarketAllowed: true,
    isSpotTradingAllowed: true,
    isMarginTradingAllowed: true,
    filters: [],
    lotSize: { minQty: 0.00001, maxQty: 9000, stepSize: 0.00001 },
    minNotional: { minNotional: 5 },
    priceFilter: { minPrice: 0.01, maxPrice: 1000000, tickSize: 0.01 },
    precision: { price: 2, amount: 5, base: 8, quote: 8 }
};

async function runBacktest() {
    console.log('🚀 Iniciando Backtest de Verificación (Smart Algo)...');
    
    const binance = new ccxt.binance();
    // Fetch last 500 candles (1m timeframe for granularity)
    console.log('Fetching datos de mercado (BTC/USDT 1m)...');
    const ohlcv = await binance.fetchOHLCV('BTC/USDT', '1m', undefined, 500);
    
    console.log(`Datos obtenidos: ${ohlcv.length} velas.`);

    const history: MarketPriceDataPoint[] = [];
    let position: BotOpenPosition | null = null;
    let balanceQuote = 1000; // 1000 USDT start
    let balanceBase = 0;
    
    let trades = 0;
    let wins = 0;
    let losses = 0;
    let profitTotal = 0;

    // Simulate loop
    for (let i = 0; i < ohlcv.length; i++) {
        const [timestamp, open, high, low, close, volume] = ohlcv[i];
        
        // Build history point
        // Need enough history for indicators.
        // We will calculate indicators on the fly based on accumulated history + current candle
        
        // To be simpler, we'll just reconstruct the full arrays for calculation
        // Optimization: In real bot we analyze full history. Here we simulate "growing" history.
        // BUT, indicators need distinct arrays.
        
        // Temporary arrays for calculation
        const currentDataSlice = ohlcv.slice(0, i + 1);
        const closes = currentDataSlice.map(c => c[4]) as number[];
        const highs = currentDataSlice.map(c => c[2]) as number[];
        const lows = currentDataSlice.map(c => c[3]) as number[];
        
        const sma50 = calculateSMA(closes, 50);
        const rsi = calculateRSI(closes, 14);
        const macd = calculateMACD(closes, 12, 26, 9);
        const bb = calculateBollingerBands(closes, 20, 2);
        const atr = calculateATR(highs as number[], lows as number[], closes as number[], 14);
        const adx = calculateADX(highs as number[], lows as number[], closes as number[], 14);
        
        const point: MarketPriceDataPoint = {
            timestamp: timestamp as number, 
            openPrice: open as number, 
            highPrice: high as number, 
            lowPrice: low as number, 
            closePrice: close as number, 
            volume: volume as number,
            sma50, rsi, 
            macdLine: macd.macdLine, signalLine: macd.signalLine, macdHistogram: macd.macdHistogram,
            upperBollingerBand: bb.upper, middleBollingerBand: bb.middle, lowerBollingerBand: bb.lower,
            atr, adx
        };
        
        history.push(point);
        
        // Need min history
        if (history.length < 52) continue;
        
        const currentPrice = close;

        // --- STRATEGY LOGIC EXECUTION ---
        
        // 1. Manage Open Position (Trailing Stop & Dynamic Exit)
        if (position) {
            let sold = false;
            let pnl = 0;
            let reason = '';

            // Update Trailing Stop State
            if (position.highestPriceReached === undefined || (currentPrice as number) > position.highestPriceReached) {
                position.highestPriceReached = currentPrice as number;
            }
            
            // Activate Trailing
            const activationPrice = position.entryPrice + (position.atrAtEntry || 0);
            if (!position.trailingStopActive && (currentPrice as number) >= activationPrice) {
                position.trailingStopActive = true;
                // console.log(`   --> Trailing Stop ACTIVADO en ${currentPrice}`);
            }

            // Move SL up
            if (position.trailingStopActive) {
                const newSL = position.highestPriceReached! - ((position.atrAtEntry || 0) * 1.5);
                if (position.stopLossPrice === undefined || newSL > position.stopLossPrice) {
                    position.stopLossPrice = newSL;
                }
            }

            // Check Exits
            if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
                sold = true; reason = 'TP';
            } else if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
                sold = true; reason = position.trailingStopActive ? 'TrailingSL' : 'SL';
            } else {
                 const isSniper = position.strategy === 'sniper';
                 const rsiExit = isSniper ? 90 : 70;
                 if (rsi >= rsiExit) {
                     sold = true; reason = 'RSI Overbought';
                 }
            }

            if (sold) {
                const valueOfSale = position.amount * currentPrice;
                const costOfBuy = position.amount * position.entryPrice;
                pnl = valueOfSale - costOfBuy;
                
                // Fee simulation (0.1% taker)
                const fee = valueOfSale * 0.001;
                pnl -= fee;
                
                balanceQuote += (valueOfSale - fee);
                balanceBase = 0;
                
                trades++;
                profitTotal += pnl;
                if (pnl > 0) wins++; else losses++;
                
                console.log(`❌ VENTA (${reason}) | PnL: ${pnl.toFixed(2)} USDT | Bal: ${balanceQuote.toFixed(2)}`);
                position = null;
            }
        } 
        
        // 2. Decide Entry
        if (!position) {
            const decision = decideTradeActionAndAmount({
                selectedMarket: mockMarket as any,
                currentMarketPriceHistory: history,
                currentPrice,
                allBinanceBalances: [{ asset: 'USDT', free: balanceQuote, locked: 0 }],
                botOpenPosition: null,
                selectedMarketRules: mockMarketRules as any,
                logStrategyMessage: () => {} // Silence logs
            });
            
            if (decision.action === 'buy' || decision.action === 'hold_insufficient_funds') {
                 // Check filters logged in details
                 // Strategy returns 'hold_insufficient_funds' usually if it wants to buy but we are mocking balances slightly diff or just to capture intention.
                 // Actually decision logic returns 'buy' if funds ok.
                 
                     if (decision.action === 'buy' && decision.orderData) {
                      const amount = decision.orderData.amount;
                      const cost = amount * (currentPrice as number);
                      const fee = cost * 0.001;
                      
                      balanceQuote -= (cost + fee);
                      balanceBase += amount;
                      
                      const atrVal = point.atr || 0;
                      
                      let slDist = 0;
                      let tpDist = 0;
                      
                      if (decision.details && decision.details.dynamicLevels) {
                          slDist = parseFloat(decision.details.dynamicLevels.sl_dist);
                          tpDist = parseFloat(decision.details.dynamicLevels.tp_dist);
                      } else {
                          const closeP = currentPrice as number;
                          slDist = Math.max(closeP * 0.015, atrVal * 3);
                          tpDist = Math.max(closeP * 0.03, atrVal * 5);
                      }
                      
                      position = {
                          marketId: 'BTCUSDT',
                          entryPrice: currentPrice as number,
                          amount: amount,
                          type: 'buy',
                          timestamp: Date.now(),
                          stopLossPrice: (currentPrice as number) - slDist,
                          takeProfitPrice: (currentPrice as number) + tpDist,
                          strategy: (decision.details?.strategyMode as any) || 'scalping',
                          trailingStopActive: false,
                          highestPriceReached: currentPrice as number,
                          atrAtEntry: atrVal
                      };
                      
                      console.log(`✅ COMPRA (${position!.strategy}) | Precio: ${currentPrice} | ATR: ${atrVal.toFixed(2)} | ADX: ${point.adx?.toFixed(2)}`);
                  }
            }
        }
    }

    console.log('--- RESULTADOS DE VERIFICACIÓN ---');
    console.log(`Total Trades: ${trades}`);
    console.log(`✅ Wins: ${wins}`);
    console.log(`❌ Losses: ${losses}`);
    console.log(`Win Rate: ${trades > 0 ? ((wins/trades)*100).toFixed(1) : 0}%`);
    console.log(`PnL Total: ${profitTotal.toFixed(2)} USDT`);
    console.log(`Balance Final: ${balanceQuote.toFixed(2)} USDT`);
    
    if (profitTotal > 0 && trades > 0) {
        console.log('RESULTADO FINAL: CUMPLE OBJETIVO (PnL Positivo)');
    } else if (trades === 0) {
        console.log('RESULTADO FINAL: NEUTRO (Sin operaciones en el periodo, filtros ADX funcionando)');
    } else {
        console.log('RESULTADO FINAL: AJUSTE REQUERIDO (PnL Negativo)');
    }
}

runBacktest().catch(console.error);
