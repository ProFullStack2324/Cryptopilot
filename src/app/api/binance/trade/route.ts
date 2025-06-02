// src/app/api/binance/trade/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Definir una interfaz para la estructura de la solicitud (request body)
interface TradeRequest {
  symbol: string; // Ejemplo: 'BTC/USDT'
  type: 'market' | 'limit'; // Tipo de orden: 'market' o 'limit'
  side: 'buy' | 'sell'; // Lado de la orden: 'buy' o 'sell'
  amount: number; // Cantidad a comprar/vender (ej. 0.001 BTC)
  price?: number; // Precio límite (opcional, solo para órdenes 'limit')
}

// Configurar el exchange de Binance
// Importante: Tus claves API deben estar en las variables de entorno (.env.local)
// Binance API Key: process.env.BINANCE_API_KEY
// Binance Secret: process.env.BINANCE_SECRET_KEY

const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    // Para futuros de USD-M (si es lo que usas), o para Spot (por defecto)
    // 'defaultType': 'future', // Descomenta si trabajas con Futuros USD-M
    // 'defaultType': 'spot',   // Por defecto si no especificas nada
  },
  // Habilitar el modo de prueba (sandbox) si lo tienes configurado en Binance
  // 'urls': {
  //   'api': {
  //     'public': 'https://testnet.binancefuture.com/fapi/v1', // Para Futuros Testnet
  //     'private': 'https://testnet.binancefuture.com/fapi/v1', // Para Futuros Testnet
  //   },
  // },
});

// Deshabilita el modo de prueba después de las pruebas iniciales si estás usando la API real
// exchange.setSandboxMode(true); // Descomentar para usar el entorno de prueba de Binance

export async function POST(req: Request) {
  if (exchange.apiKey === undefined || exchange.secret === undefined) {
    return NextResponse.json({
      success: false,
      message: "Las credenciales de Binance no están configuradas en las variables de entorno."
    }, { status: 500 });
  }

  try {
    const { symbol, type, side, amount, price }: TradeRequest = await req.json();

    if (!symbol || !type || !side || !amount) {
      return NextResponse.json({
        success: false,
        message: "Faltan parámetros requeridos (symbol, type, side, amount)."
      }, { status: 400 });
    }

    let order;
    if (type === 'limit' && price === undefined) {
      return NextResponse.json({
        success: false,
        message: "El precio es requerido para órdenes límite."
      }, { status: 400 });
    }

    console.log(`[API/Binance/Trade] Intentando crear orden: ${side} ${amount} ${symbol} de tipo ${type}${type === 'limit' ? ` @ ${price}` : ''}`);

    if (type === 'market') {
      order = await exchange.createMarketOrder(symbol, side, amount);
    } else if (type === 'limit') {
      order = await exchange.createLimitOrder(symbol, side, amount, price!);
    } else {
      return NextResponse.json({
        success: false,
        message: "Tipo de orden no soportado. Usa 'market' o 'limit'."
      }, { status: 400 });
    }

    console.log("[API/Binance/Trade] Orden creada con éxito:", order);

    return NextResponse.json({
      success: true,
      message: "Orden creada con éxito en Binance.",
      orderId: order.id,
      status: order.status,
      // Puedes devolver más detalles de la orden si los necesitas en el frontend
      // order: order,
    });

  } catch (error: any) {
    console.error("[API/Binance/Trade] Error al crear la orden:", error);
    // ccxt a menudo incluye el mensaje de error de la API de Binance
    return NextResponse.json({
      success: false,
      message: `Error al crear la orden: ${error.message || 'Error desconocido'}`,
      details: error.response?.data ? JSON.parse(error.response.data.toString()).msg : 'No hay detalles adicionales'
    }, { status: 500 });
  }
}