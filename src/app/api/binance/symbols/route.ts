// src/app/api/binance/symbols/route.ts
import { NextResponse } from 'next/server';
import Binance from 'node-binance-api'; // ¡Cambiado a node-binance-api!

// Asegúrate de que tus claves API estén en variables de entorno (ej. .env.local)
const apiKey = process.env.BINANCE_API_KEY || '';
const apiSecret = process.env.BINANCE_API_SECRET || '';

// Instancia el cliente de Binance con node-binance-api
const binance = new Binance().options({
  APIKEY: apiKey,
  APISECRET: apiSecret
});

export async function GET() {
  try {
    // Usamos exchangeInfo() para obtener todos los símbolos y sus reglas.
    const data = await binance.exchangeInfo();

    // Filtramos los símbolos según tus criterios
    const symbols = data.symbols
      .filter((s: any) =>
        s.status === 'TRADING' && // Solo símbolos activos para trading
        s.quoteAsset === 'USDT' && // Solo pares con USDT
        // Filtro opcional: Asegúrate de que exista un filtro MIN_NOTIONAL
        // y que el minNotional sea menor o igual a 10.
        s.filters.some((f: any) => f.filterType === 'MIN_NOTIONAL' && parseFloat(f.minNotional) <= 10)
      )
      .map((s: any) => ({
        id: s.symbol, // El símbolo completo (ej. BTCUSDT)
        name: `<span class="math-inline">\{s\.baseAsset\}/</span>{s.quoteAsset}`, // Nombre amigable (ej. BTC/USDT)
        baseAsset: s.baseAsset, // Moneda base (ej. BTC)
        quoteAsset: s.quoteAsset, // Moneda cotizada (ej. USDT)
        latestPrice: 0 // Se actualizará en el frontend con el ticker
      }));

    return NextResponse.json({ message: 'Símbolos obtenidos con éxito', symbols });
  } catch (error: any) {
    console.error('Error al obtener los símbolos de Binance con node-binance-api:', error);
    return NextResponse.json(
      { message: 'Error al obtener los símbolos de Binance', error: error.message },
      { status: 500 }
    );
  }
}