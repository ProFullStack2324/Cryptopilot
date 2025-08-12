// src/app/api/binance/klines/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Configura la instancia de CCXT para Mainnet Binance Spot
const exchangeMainnet = new ccxt.binance({
    apiKey: process.env.BINANCE_API_KEY,
    secret: process.env.BINANCE_SECRET_KEY,
    options: {
        'defaultType': 'spot',
        // ✅ AJUSTE CRÍTICO: Habilitar el ajuste automático de la diferencia horaria
        'adjustForTimeDifference': true,
        // ✅ AJUSTE CRÍTICO: Aumentar la ventana de recepción a 60 segundos (60000ms)
        'recvWindow': 60000, 
    },
    enableRateLimit: true, // Habilitar el control de límites de tasa
    timeout: 10000,
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = searchParams.get('symbol'); // Ej: 'BTC/USDT'
        const intervalParam = searchParams.get('interval') || '1m'; // Ej: '1m', '5m', '1h' (default: '1m')
        const limitParam = searchParams.get('limit'); // Cantidad de velas a obtener (default de CCXT es 1000)
        const limit = limitParam ? parseInt(limitParam, 10) : 200; // Por ejemplo, 200 velas

        if (!symbolParam) {
            return NextResponse.json({ success: false, message: 'Falta el parámetro "symbol".' }, { status: 400 });
        }

        console.log(`[API/Binance/Klines] Obteniendo ${limit} velas de ${intervalParam} para ${symbolParam}...`);

        if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
            console.error('[API/Binance/Klines] Credenciales de Mainnet no configuradas.');
            return NextResponse.json({
                success: false,
                message: 'Credenciales de Binance Mainnet no configuradas en variables de entorno.',
            }, { status: 500 });
        }

        try {
            await exchangeMainnet.loadMarkets();
            const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;

            // Obtener velas (OHLCV) de Binance
            // OHLCV: [timestamp, open, high, low, close, volume]
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
                return NextResponse.json({
                    success: false,
                    message: 'Error de autenticación al obtener velas. Verifica tus claves API.',
                    details: err.message || err.toString(),
                }, { status: 401 });
            } else if (err instanceof ccxt.NetworkError) {
                return NextResponse.json({
                    success: false,
                    message: 'Error de red al conectar con Binance para obtener velas.',
                    details: err.message || err.toString(),
                }, { status: 503 });
            } else if (err instanceof ccxt.ExchangeError) {
                // Errores específicos del exchange (ej. símbolo o intervalo inválido)
                return NextResponse.json({
                    success: false,
                    message: 'Error del exchange al solicitar velas.',
                    details: err.message || err.toString(),
                }, { status: 400 });
            }
            return NextResponse.json({
                success: false,
                message: 'Error interno al obtener velas.',
                details: err.message || err.toString(),
            }, { status: 500 });
        }
    } catch (err: any) {
        console.error('[API/Binance/Klines] Error genérico en GET:', err);
        return NextResponse.json({
            success: false,
            message: 'Error genérico en endpoint GET de klines.',
            details: err.message || err.toString(),
        }, { status: 500 });
    }
}
