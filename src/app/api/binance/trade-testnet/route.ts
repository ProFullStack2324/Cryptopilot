// src/app/api/binance/trade-testnet/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Interfaz para la estructura de la solicitud (request body)
interface TradeRequest {
  symbol: string; 
  type: 'market' | 'limit'; 
  side: 'buy' | 'sell'; 
  amount: number; 
  price?: number; 
  // No necesitamos isTestnet aquí, este endpoint es solo para Testnet
}

// --- Configuración de CCXT para la Red de Prueba (Testnet) ---
// Estas claves API se usarán para las operaciones en la red de prueba de Binance.
const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY, // Clave API de Testnet desde .env.local
    secret: process.env.BINANCE_TESTNET_SECRET_KEY, // Clave Secreta de Testnet desde .env.local
    options: {
        // 'defaultType': 'spot', // o 'future', si operas principalmente en un tipo de mercado en testnet
    },
    urls: {
        // URLs específicas para la API de Testnet de Binance.
        // Es CRUCIAL que estas URLs sean las correctas para el tipo de mercado de Testnet
        // que estás utilizando (ej. Spot Testnet o Futures Testnet).
        // Consulta la documentación de Binance para las URLs exactas.
        
        // Ejemplo para Spot Testnet:
         'api': {
           'public': 'https://testnet.binance.vision/api/',
           'private': 'https://testnet.binance.vision/api/',
         },
        // Ejemplo para Futures USD-M Testnet:
        // 'fapi': { // Nota: 'fapi' para futuros USD-M
        //   'public': 'https://testnet.binancefuture.com/fapi/v1',
        //   'private': 'https://testnet.binancefuture.com/fapi/v1',
        // },
        // Ejemplo para Futures COIN-M Testnet:
        // 'dapi': { // Nota: 'dapi' para futuros COIN-M
        //     'public': 'https://testnet.binancefuture.com/dapi/v1',
        //     'private': 'https://testnet.binancefuture.com/dapi/v1',
        // }
    },
    // ccxt a menudo maneja el modo sandbox/testnet a través de las URLs
    // y la configuración 'test' en options, pero especificar URLs es más explícito.
    // 'test': true, // Esto podría ser otra forma, pero las URLs son más seguras.
});
// --- Fin Configuración CCXT Testnet ---


export async function POST(req: Request) {
  let symbol, type, side, amount, price;
  const networkType = 'Testnet'; // Este endpoint siempre opera en Testnet

  try {
      const requestBody: TradeRequest = await req.json();
      ({ symbol, type, side, amount, price } = requestBody); 
      console.log(`[API/Binance/Trade/${networkType}] Recibida solicitud: ${side.toUpperCase()} ${amount} de ${symbol}`);

  } catch (jsonError: any) {
      console.error(`[API/Binance/Trade/${networkType}] Error al parsear JSON:`, jsonError);
      return NextResponse.json({
        success: false,
        message: "Error procesando solicitud. JSON inválido."
      }, { status: 400 });
  }

  // --- Validación de Credenciales de Testnet ---
  if (exchangeTestnet.apiKey === undefined || exchangeTestnet.secret === undefined) {
    console.error(`[API/Binance/Trade/${networkType}] Error: Credenciales de ${networkType} no configuradas en .env.local.`);
    return NextResponse.json({
      success: false,
      message: `Credenciales de Binance ${networkType} no configuradas. Revisa BINANCE_TESTNET_API_KEY y BINANCE_TESTNET_SECRET_KEY en .env.local.`
    }, { status: 500 });
  }
  console.log(`[API/Binance/Trade/${networkType}] Credenciales cargadas.`);

  // --- Validación de Parámetros de la Orden ---
  if (!symbol || !type || !side || amount === undefined || amount === null || amount <= 0) {
    return NextResponse.json({ success: false, message: "Parámetros inválidos (symbol, type, side, amount)." }, { status: 400 });
  }
  if (type === 'limit' && (price === undefined || price === null || price <= 0)) {
    return NextResponse.json({ success: false, message: "Precio requerido para órdenes límite." }, { status: 400 });
  }
  if (type !== 'market' && type !== 'limit') {
    return NextResponse.json({ success: false, message: "Tipo de orden no soportado." }, { status: 400 });
  }
  console.log(`[API/Binance/Trade/${networkType}] Parámetros validados.`);

  // --- Creación de la Orden usando CCXT en Testnet ---
  try {
    console.log(`[API/Binance/Trade/${networkType}] Enviando orden a CCXT: ${side.toUpperCase()} ${amount} de ${symbol} (${type.toUpperCase()})`);
    let order;
    if (type === 'market') {
      order = await exchangeTestnet.createMarketOrder(symbol, side, amount);
    } else { 
      order = await exchangeTestnet.createLimitOrder(symbol, side, amount, price!);
    }
    console.log(`[API/Binance/Trade/${networkType}] Orden procesada. ID: ${order.id}, Estado: ${order.status}`);
    return NextResponse.json({
      success: true,
      message: `Orden de ${side} creada con éxito en Binance ${networkType}.`,
      orderId: order.id,
      status: order.status,
      symbol: order.symbol, 
      side: order.side,
      type: order.type,
      amount: order.amount,
      price: order.price, 
      filled: order.filled, 
      remaining: order.remaining, 
      cost: order.cost, 
    });

  } catch (error: any) {
    console.error(`[API/Binance/Trade/${networkType}] Error CCXT al ejecutar orden:`, error);
    let userMessage = `Error procesando orden en Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;
    let binanceErrorCode = undefined;

    if (error instanceof ccxt.InsufficientFunds) {
         userMessage = `Fondos Insuficientes en Binance ${networkType}.`;
         statusCode = 400; 
    } else if (error instanceof ccxt.InvalidOrder) {
         userMessage = `Parámetros de orden inválidos para Binance ${networkType}.`;
         statusCode = 400; 
         if (error.message.includes('code=')) {
             const codeMatch = error.message.match(/code=(-?\d+)/);
             if (codeMatch && codeMatch[1]) binanceErrorCode = parseInt(codeMatch[1], 10);
         }
    }  else if (error instanceof ccxt.AuthenticationError) { 
        userMessage = `Error de autenticación con Binance ${networkType}. Revisa tus API Keys de Testnet.`;
        statusCode = 401;
        if (error.message.includes('code=')) {
             const codeMatch = error.message.match(/code=(-?\d+)/);
             // El error -2015 (Invalid API-key, IP, or permissions for action) es un AuthenticationError
             if (codeMatch && codeMatch[1]) binanceErrorCode = parseInt(codeMatch[1], 10);
         }
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = `Error de conexión con Binance ${networkType}.`;
        statusCode = 503; 
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = `Error del exchange Binance ${networkType}.`;
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) binanceErrorCode = parseInt(codeMatch[1], 10);
          }
    }
    return NextResponse.json({
      success: false,
      message: userMessage, 
      details: details,     
      binanceErrorCode: binanceErrorCode, 
    }, { status: statusCode });
  }
}
