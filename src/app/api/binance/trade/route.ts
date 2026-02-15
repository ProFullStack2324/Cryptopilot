import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { exchangeMainnet } from '@/lib/binance-client';
import { z } from 'zod';

const TradeRequestSchema = z.object({
  symbol: z.string(),
  type: z.enum(['market', 'limit']),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().positive().optional(),
}).refine(data => data.type !== 'limit' || (data.price && data.price > 0), {
  message: "Price is required for limit orders.",
  path: ["price"]
});

interface TradeRequest {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

export async function POST(req: Request) {
  let ccxtSymbol: string = '';

  try {
    const rawBody = await req.json();
    const validation = TradeRequestSchema.safeParse(rawBody);
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        message: 'Parámetros de trading inválidos.', 
        errors: validation.error.format() 
      }, { status: 400 });
    }

    const { symbol, type, side, amount, price } = validation.data;
    console.log(`[API/Binance/Trade/Mainnet] Recibida solicitud validada: ${JSON.stringify(validation.data)}`);

    await exchangeMainnet.loadMarkets();
    ccxtSymbol = symbol.includes('/') ? symbol : `${symbol.replace(/USDT$/i, '')}/USDT`;
    const market = exchangeMainnet.markets[ccxtSymbol];
    if (!market) {
      return NextResponse.json({ success: false, message: `Símbolo no soportado: ${ccxtSymbol}`}, { status: 400 });
    }

    console.log(`[API/Binance/Trade/Mainnet] Creando orden: ${side.toUpperCase()} ${amount} ${ccxtSymbol} (${type.toUpperCase()})`);
    let order;
    if (type === 'market') {
      order = await exchangeMainnet.createMarketOrder(ccxtSymbol, side, amount);
    } else {
      order = await exchangeMainnet.createLimitOrder(ccxtSymbol, side, amount, price!);
    }
    console.log(`[API/Binance/Trade/Mainnet] Orden procesada: ID=${order.id}, status=${order.status}`);
    
    return NextResponse.json({
      success: true,
      message: `Orden ${side} creada en Mainnet.`,
      orderId: order.id,
      status: order.status,
      data: order,
    }, { status: 200 });

  } catch (err: any) {
    console.error(`[API/Binance/Trade/Mainnet] Error al ejecutar orden:`, err);
    let userMessage = `Error al procesar la orden en Mainnet.`;
    let statusCode = 500;

    if (err.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible: La API de Binance está restringiendo el acceso desde la ubicación del servidor.";
        statusCode = 403; // Forbidden
    } else if (err instanceof ccxt.InsufficientFunds) {
        userMessage = `Fondos insuficientes en Mainnet.`;
        statusCode = 400;
    } else if (err instanceof ccxt.InvalidOrder) {
        userMessage = `Orden inválida según las reglas de Mainnet. Detalles: ${err.message}`;
        statusCode = 400;
    } else if (err instanceof ccxt.AuthenticationError) {
        userMessage = "Error de autenticación. Causa probable: La IP pública de tu red no está en la lista blanca (whitelist) de tu clave API en Binance, o la clave no tiene los permisos necesarios.";
        statusCode = 401;
    } else if (err instanceof ccxt.NetworkError || err instanceof ccxt.RequestTimeout) {
        userMessage = `Error de conexión o timeout con Binance Mainnet. Detalles: ${err.message}`;
        statusCode = 503;
    } else if (err instanceof ccxt.ExchangeError) {
        userMessage = `Error del exchange: ${err.message}`;
        statusCode = 502;
    }

    return NextResponse.json({
        success: false,
        message: userMessage,
        details: err.message,
    }, { status: statusCode });
  }
}
