// src/app/api/binance/trade/route.ts
import { NextResponse } from 'next/server';
import { exchange } from '@/lib/binance-client'; // Importar cliente centralizado
import ccxt from 'ccxt';

interface TradeRequest {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

export async function POST(req: Request) {
  const networkType = 'Futures Testnet';
  let ccxtSymbol: string = '';

  try {
    const body: TradeRequest = await req.json();
    const { symbol, type, side, amount, price } = body;
    console.log(`[API/Binance/Trade/${networkType}] Recibida solicitud POST: ${JSON.stringify(body)}`);

    if (!exchange.apiKey || !exchange.secret) {
      console.error(`[API/Binance/Trade/${networkType}] Credenciales no configuradas.`);
      return NextResponse.json({ success: false, message: `Credenciales de Binance ${networkType} no configuradas.` }, { status: 500 });
    }
    
    if (!symbol || !type || !side || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Parámetros inválidos (symbol, type, side, amount).'}, { status: 400 });
    }
    if (type === 'limit' && (!price || price <= 0)) {
      return NextResponse.json({ success: false, message: 'El precio es requerido para órdenes límite.'}, { status: 400 });
    }

    await exchange.loadMarkets();
    ccxtSymbol = symbol.includes('/') ? symbol : `${symbol.replace(/USDT$/i, '')}/USDT`;
    const market = exchange.markets[ccxtSymbol];
    if (!market) {
      return NextResponse.json({ success: false, message: `Símbolo no soportado: ${ccxtSymbol}`}, { status: 400 });
    }

    console.log(`[API/Binance/Trade/${networkType}] Creando orden: ${side.toUpperCase()} ${amount} ${ccxtSymbol} (${type.toUpperCase()})`);
    let order;
    if (type === 'market') {
      order = await exchange.createMarketOrder(ccxtSymbol, side, amount);
    } else {
      order = await exchange.createLimitOrder(ccxtSymbol, side, amount, price!);
    }
    console.log(`[API/Binance/Trade/${networkType}] Orden procesada: ID=${order.id}, status=${order.status}`);
    
    return NextResponse.json({
      success: true,
      message: `Orden ${side} creada en ${networkType}.`,
      orderId: order.id,
      status: order.status,
      data: order, // Devolvemos el objeto de orden completo en 'data'
    }, { status: 200 });

  } catch (err: any) {
    console.error(`[API/Binance/Trade/${networkType}] Error al ejecutar orden:`, err);
    let userMessage = `Error al procesar la orden en ${networkType}.`;
    let statusCode = 500;

    if (err instanceof ccxt.InsufficientFunds) {
        userMessage = `Fondos insuficientes en ${networkType}.`;
        statusCode = 400;
    } else if (err instanceof ccxt.InvalidOrder) {
        userMessage = `Orden inválida según las reglas de ${networkType}. Detalles: ${err.message}`;
        statusCode = 400;
    } else if (err instanceof ccxt.AuthenticationError) {
        userMessage = `Error de autenticación en ${networkType}. Verifica tus claves API de Testnet.`;
        statusCode = 401;
    } else if (err instanceof ccxt.NetworkError) {
        userMessage = `Error de conexión con Binance ${networkType}.`;
        statusCode = 503;
    }

    return NextResponse.json({
        success: false,
        message: userMessage,
        details: err.message,
    }, { status: statusCode });
  }
}
