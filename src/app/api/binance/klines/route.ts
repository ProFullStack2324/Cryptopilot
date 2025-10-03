// src/app/api/binance/klines/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot',
    'adjustForTimeDifference': true,
  },
  enableRateLimit: true,
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = searchParams.get('symbol');
        const intervalParam = searchParams.get('interval') || '1m';
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 200;

        if (!symbolParam) {
            return NextResponse.json({ success: false, message: 'Falta el parámetro "symbol".' }, { status: 400 });
        }

        console.log(`[API/Binance/Klines] Obteniendo ${limit} velas de ${intervalParam} para ${symbolParam} desde Mainnet...`);

        try {
            await exchangeMainnet.loadMarkets();
            const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;

            const ohlcv = await exchangeMainnet.fetchOHLCV(ccxtSymbol, intervalParam, undefined, limit);

            if (!ohlcv || ohlcv.length === 0) {
                console.warn(`[API/Binance/Klines] No se encontraron velas para ${ccxtSymbol} con intervalo ${intervalParam}.`);
                return NextResponse.json({ success: true, symbol: ccxtSymbol, interval: intervalParam, klines: [] }, { status: 200 });
            }

            console.log(`[API/Binance/Klines] ${ohlcv.length} velas obtenidas para ${ccxtSymbol}.`);
            return NextResponse.json({ success: true, symbol: ccxtSymbol, interval: intervalParam, klines: ohlcv }, { status: 200 });

        } catch (err: any) {
            console.error('[API/Binance/Klines] Error al obtener velas:', err);
             if (err instanceof ccxt.AuthenticationError) {
                return NextResponse.json({ success: false, message: 'Error de autenticación al obtener velas. Verifica tus claves API de Mainnet.' }, { status: 401 });
            } else if (err instanceof ccxt.NetworkError) {
                return NextResponse.json({ success: false, message: 'Error de red al conectar con Binance Mainnet.' }, { status: 503 });
            } else if (err instanceof ccxt.ExchangeError) {
                if (err.message.includes('Service unavailable from a restricted location')) {
                    return NextResponse.json({ success: false, message: 'Servicio no disponible desde una ubicación restringida.', details: 'La API de Binance Spot está restringiendo el acceso desde la ubicación del servidor.' }, { status: 403 });
                }
                return NextResponse.json({ success: false, message: 'Error del exchange al solicitar velas.', details: err.message }, { status: 400 });
            }
            return NextResponse.json({ success: false, message: 'Error interno al obtener velas.', details: err.message }, { status: 500 });
        }
    } catch (err: any) {
        console.error('[API/Binance/Klines] Error genérico en GET:', err);
        return NextResponse.json({ success: false, message: 'Error genérico en endpoint GET de klines.', details: err.message }, { status: 500 });
    }
}
