// src/lib/bot/trading-service.ts
import { exchangeMainnet } from '@/lib/binance-client';
import { decideTradeActionAndAmount } from '@/lib/strategies/tradingStrategy';
import { 
    Market, 
    MarketRules, 
    BinanceBalance, 
    BotOpenPosition, 
    BotActionDetails, 
    KLine, 
    MarketPriceDataPoint,
    PRICE_HISTORY_POINTS_TO_KEEP
} from '@/lib/types';
import { calculateSMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR, calculateADX } from '@/lib/indicators';
import fs from 'fs';
import path from 'path';
import clientPromise from '@/lib/mongodb-client';
import { ObjectId } from 'mongodb';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
// @ts-ignore
import Binance from 'node-binance-api';

const LOG_FILE = path.join(process.cwd(), 'bot_execution.log');

function logToFile(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
}

class TradingService {
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private selectedMarket: Market | null = null;
    private timeframe: string = '5m';
    private botOpenPosition: BotOpenPosition | null = null;
    private history: MarketPriceDataPoint[] = [];
    private rules: MarketRules | null = null;
    private lastTickTimestamp: number = 0;

    private binanceWS: any;

    constructor() {
        logToFile('TradingService initialized');
        this.binanceWS = new Binance().options({
            APIKEY: process.env.BINANCE_API_KEY,
            APISECRET: process.env.BINANCE_SECRET_KEY,
            useServerTime: true
        });
    }

    public async start(market: Market, timeframe: string) {
        if (this.isRunning) return;
        
        this.selectedMarket = market;
        this.timeframe = timeframe;
        this.isRunning = true;
        
        logToFile(`Bot STARTED for ${market.symbol} (${timeframe}) - WebSocket Enabled`);
        
        // Recover state from DB if exists
        await this.loadStateFromDB();
        
        // Initial data load (REST for history)
        await this.refreshData();
        
        // Start WebSocket stream for real-time prices
        this.startWebSocketStream(market.symbol);
    }

    private startWebSocketStream(symbol: string) {
        const binanceSymbol = symbol.toUpperCase().replace('/', '');
        logToFile(`Starting WebSocket for ${binanceSymbol}`);
        
        this.binanceWS.websockets.prevDay(binanceSymbol, (error: any, response: any) => {
            if (error) {
                logToFile(`WS Error: ${error.message || error}`);
                return;
            }
            
            const latestPrice = parseFloat(response.close);
            if (this.history.length > 0) {
                const latest = this.history[this.history.length - 1];
                latest.closePrice = latestPrice;
                this.lastTickTimestamp = Date.now();
                
                // Execute strategy logic on every price update (Ultra-low latency)
                this.executeStrategy();
            }
        });
    }

    public stop() {
        if (!this.isRunning) return;
        
        if (this.intervalId) {
            // No longer used in WS mode, but kept for cleanup safety
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Terminate WebSocket if possible (node-binance-api manages this)
        // For node-binance-api, we might need a specific way to close streams if we want to be thorough
        
        this.isRunning = false;
        logToFile('Bot STOPPED');
    }

    public getStatus() {
        return {
            isRunning: this.isRunning,
            market: this.selectedMarket?.symbol || null,
            timeframe: this.timeframe,
            lastTick: this.lastTickTimestamp,
            historyPoints: this.history.length,
            hasPosition: !!this.botOpenPosition
        };
    }

    private async tick() {
        // Obsolete in WebSocket mode, but could be used for health checks
    }

    private async refreshData() {
        if (!this.selectedMarket) return;
        
        try {
            // Load Rules
            await exchangeMainnet.loadMarkets();
            const marketInfo = exchangeMainnet.market(this.selectedMarket.symbol);
            this.rules = this.mapMarketToRules(marketInfo);
            
            // Load HLINES
            const klines = await exchangeMainnet.fetchOHLCV(this.selectedMarket.symbol, this.timeframe, undefined, PRICE_HISTORY_POINTS_TO_KEEP);
            this.history = this.annotateHistory(klines as KLine[]);
            
            logToFile(`Data refreshed. History size: ${this.history.length}`);
        } catch (error: any) {
            logToFile(`Error refreshing data: ${error.message}`);
        }
    }

    private async refreshPrices() {
        if (!this.selectedMarket) return;
        
        try {
            const ticker = await exchangeMainnet.fetchTicker(this.selectedMarket.symbol);
            const latestPrice = ticker.last!;
            
            // Update last point or add new one if timeframe changed (simplified for polling)
            // In a real bot, we would handle candle closing properly.
            // For now, let's keep it similar to the hook logic.
            if (this.history.length > 0) {
                const latest = this.history[this.history.length - 1];
                latest.closePrice = latestPrice;
                // Note: ATR/ADX calculation simplified here for polling.
            }
        } catch (error: any) {
            logToFile(`Error refreshing prices: ${error.message}`);
        }
    }

    private async executeStrategy() {
        if (!this.selectedMarket || !this.rules || this.history.length < 50) return;

        const currentPrice = this.history[this.history.length - 1].closePrice;
        const balances = await this.getBalances();

        const decision = decideTradeActionAndAmount({
            selectedMarket: this.selectedMarket,
            currentMarketPriceHistory: this.history,
            currentPrice,
            allBinanceBalances: balances,
            botOpenPosition: this.botOpenPosition,
            selectedMarketRules: this.rules,
            logStrategyMessage: (msg) => logToFile(`Strategy: ${msg}`)
        });

        if (decision.action === 'buy' && decision.orderData) {
            await this.executeBuy(decision.orderData);
        } else if (decision.action === 'sell' && this.botOpenPosition) {
            await this.executeSell();
        }
    }

    private async getBalances(): Promise<BinanceBalance[]> {
        const rawBalances: any = await exchangeMainnet.fetchBalance();
        return Object.entries(rawBalances.total).map(([asset, total]) => ({
            asset,
            free: parseFloat(rawBalances.free[asset]) || 0,
            locked: parseFloat(rawBalances.used[asset]) || 0
        }));
    }

    private async executeBuy(orderData: any) {
        logToFile(`EXECUTE BUY: ${JSON.stringify(orderData)}`);
        try {
            const order = await exchangeMainnet.createMarketOrder(this.selectedMarket!.symbol, 'buy', orderData.amount);
            logToFile(`BUY SUCCESS: ID ${order.id}`);
            
            const position: BotOpenPosition = {
                marketId: this.selectedMarket!.id,
                entryPrice: parseFloat(order.price as any || order.average as any),
                amount: parseFloat(order.amount as any || order.filled as any),
                type: 'buy',
                timestamp: Date.now(),
                strategy: 'scalping',
                // Niveles base si la estrategia los devuelve
                takeProfitPrice: orderData.takeProfitPrice,
                stopLossPrice: orderData.stopLossPrice
            };

            this.botOpenPosition = position;
            await this.savePositionToDB(position);
            
            await sendTelegramMessage(`🚀 *ORDEN DE COMPRA EJECUTADA*\n\n*Mercado:* ${this.selectedMarket!.symbol}\n*Precio:* ${position.entryPrice}\n*Cantidad:* ${position.amount}\n*Estrategia:* ${position.strategy}`);
        } catch (error: any) {
            logToFile(`BUY FAILED: ${error.message}`);
            await sendTelegramMessage(`❌ *FALLO EN COMPRA*:\n${this.selectedMarket!.symbol}: ${error.message}`);
        }
    }

    private async executeSell() {
        if (!this.botOpenPosition) return;
        logToFile(`EXECUTE SELL: ${this.botOpenPosition.amount}`);
        try {
            const order = await exchangeMainnet.createMarketOrder(this.selectedMarket!.symbol, 'sell', this.botOpenPosition.amount);
            logToFile(`SELL SUCCESS: ID ${order.id}`);
            
            await this.removePositionFromDB();
            const profit = this.botOpenPosition.entryPrice ? 
                (((order.price as any || order.average as any) - this.botOpenPosition.entryPrice) / this.botOpenPosition.entryPrice * 100).toFixed(2) : '0';
            
            await sendTelegramMessage(`💰 *ORDEN DE VENTA EJECUTADA*\n\n*Mercado:* ${this.selectedMarket!.symbol}\n*PnL Est.:* ${profit}%\n*Precio:* ${order.price || order.average}`);
            
            this.botOpenPosition = null;
        } catch (error: any) {
            logToFile(`SELL FAILED: ${error.message}`);
            await sendTelegramMessage(`❌ *FALLO EN VENTA*:\n${this.selectedMarket!.symbol}: ${error.message}`);
        }
    }

    private async loadStateFromDB() {
        try {
            const client = await clientPromise;
            const db = client.db("cryptopilot_db");
            const collection = db.collection("active_positions");
            
            // Buscar si hay una posición abierta para el mercado seleccionado
            const savedPosition = await collection.findOne({ marketId: this.selectedMarket?.id, status: 'OPEN' });
            if (savedPosition) {
                this.botOpenPosition = {
                    marketId: savedPosition.marketId,
                    entryPrice: savedPosition.entryPrice,
                    amount: savedPosition.amount,
                    type: savedPosition.type,
                    timestamp: savedPosition.timestamp,
                    strategy: savedPosition.strategy,
                    takeProfitPrice: savedPosition.takeProfitPrice,
                    stopLossPrice: savedPosition.stopLossPrice
                };
                logToFile(`RECOVERED position from DB: ${JSON.stringify(this.botOpenPosition)}`);
            }
        } catch (error: any) {
            logToFile(`DB Recovery Error: ${error.message}`);
        }
    }

    private async savePositionToDB(position: BotOpenPosition) {
        try {
            const client = await clientPromise;
            const db = client.db("cryptopilot_db");
            const collection = db.collection("active_positions");
            
            await collection.insertOne({
                ...position,
                status: 'OPEN',
                createdAt: new Date()
            });
            logToFile('Position saved to MongoDB');
        } catch (error: any) {
            logToFile(`DB Save Error: ${error.message}`);
        }
    }

    private async removePositionFromDB() {
        if (!this.botOpenPosition) return;
        try {
            const client = await clientPromise;
            const db = client.db("cryptopilot_db");
            const collection = db.collection("active_positions");
            
            // Marcar como cerrada en lugar de borrar para historial
            await collection.updateOne(
                { marketId: this.botOpenPosition.marketId, status: 'OPEN' },
                { $set: { status: 'CLOSED', closedAt: new Date() } }
            );
            logToFile('Position marked as CLOSED in MongoDB');
        } catch (error: any) {
            logToFile(`DB Update Error: ${error.message}`);
        }
    }

    private mapMarketToRules(info: any): MarketRules {
        const lotSizeFilter = info.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
        const minNotionalFilter = info.filters?.find((f: any) => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL');
        const priceFilter = info.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');

        return {
            symbol: info.symbol,
            status: info.active ? 'TRADING' : 'BREAK',
            baseAsset: info.base,
            quoteAsset: info.quote,
            baseAssetPrecision: info.precision.amount,
            quotePrecision: info.precision.price,
            icebergAllowed: false,
            ocoAllowed: false,
            quoteOrderQtyMarketAllowed: true,
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: false,
            filters: info.info.filters || [],
            lotSize: {
                minQty: parseFloat(lotSizeFilter?.minQty) || 0,
                maxQty: parseFloat(lotSizeFilter?.maxQty) || 0,
                stepSize: parseFloat(lotSizeFilter?.stepSize) || 0
            },
            minNotional: {
                minNotional: parseFloat(minNotionalFilter?.minNotional || minNotionalFilter?.notional) || 0
            },
            priceFilter: {
                minPrice: parseFloat(priceFilter?.minPrice) || 0,
                maxPrice: parseFloat(priceFilter?.maxPrice) || 0,
                tickSize: parseFloat(priceFilter?.tickSize) || 0
            },
            precision: {
                price: info.precision.price,
                amount: info.precision.amount,
                base: info.precision.base,
                quote: info.precision.quote
            }
        };
    }

    private annotateHistory(klines: KLine[]): MarketPriceDataPoint[] {
        const closes = klines.map(k => k[4]);
        const annotated: MarketPriceDataPoint[] = [];

        for (let i = 0; i < klines.length; i++) {
            const currentCloses = klines.slice(0, i + 1).map(k => k[4]);
            const [timestamp, openPrice, highPrice, lowPrice, closePrice, volume] = klines[i];

            const sma50 = calculateSMA(currentCloses, 50);
            const rsi = calculateRSI(currentCloses, 14);
            const macd = calculateMACD(currentCloses, 12, 26, 9);
            const bb = calculateBollingerBands(currentCloses, 20, 2);

            const currentHighs = klines.slice(0, i + 1).map(k => k[2]);
            const currentLows = klines.slice(0, i + 1).map(k => k[3]);
            const atr = calculateATR(currentHighs, currentLows, currentCloses, 14);
            const adx = calculateADX(currentHighs, currentLows, currentCloses, 14);

            annotated.push({
                timestamp, openPrice, highPrice, lowPrice, closePrice, volume,
                sma50, rsi,
                macdHistogram: macd.macdHistogram,
                upperBollingerBand: bb.upper,
                lowerBollingerBand: bb.lower,
                atr, adx
            });
        }
        return annotated;
    }
}

// Singleton instance
let tradingService: TradingService;

if (process.env.NODE_ENV === 'production') {
    tradingService = new TradingService();
} else {
    if (!(global as any)._tradingService) {
        (global as any)._tradingService = new TradingService();
    }
    tradingService = (global as any)._tradingService;
}

export default tradingService;
