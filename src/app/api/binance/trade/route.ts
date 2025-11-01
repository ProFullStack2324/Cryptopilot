// src/app/api/binance/trade/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { exchangeMainnet } from '@/lib/binance-client'; // Importar la instancia centralizada

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
    const body: TradeRequest = await req.json();
    const { symbol, type, side, amount, price } = body;
    console.log(`[API/Binance/Trade/Mainnet] Recibida solicitud POST: ${JSON.stringify(body)}`);

    if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
      console.error(`[API/Binance/Trade/Mainnet] Credenciales no configuradas.`);
      return NextResponse.json({ success: false, message: `Credenciales de Binance Mainnet no configuradas.` }, { status: 500 });
    }
    
    if (!symbol || !type || !side || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Parámetros inválidos (symbol, type, side, amount).'}, { status: 400 });
    }
    if (type === 'limit' && (!price || price <= 0)) {
      return NextResponse.json({ success: false, message: 'El precio es requerido para órdenes límite.'}, { status: 400 });
    }

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
