// 📁 Ruta: src/app/api/binance/trade-testnet/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Definir la interfaz para la estructura de la solicitud (request body)
interface TradeRequest {
  symbol: string; // Ejemplo: 'BTC/USDT'
  type: 'market' | 'limit'; // Tipo de orden: 'market' o 'limit'
  side: 'buy' | 'sell'; // Lado de la orden: 'buy' o 'sell'
  amount: number; // Cantidad a comprar/vender (ej. 0.001 BTC)
  price?: number; // Precio límite (opcional, solo para órdenes 'limit')
}

// Configura la instancia de CCXT para Mainnet Binance Spot
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot',
  },
  enableRateLimit: true,
  timeout: 10000,
});

// Nota: en este endpoint usaremos Mainnet únicamente. 
// Para Testnet podría usarse otro endpoint separado o bandera isTestnet, 
// pero aquí se configura para operaciones reales Mainnet.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // ?balance=true
    if (searchParams.has('balance')) {
      console.log('[API/Binance/Trade/Mainnet] Obteniendo balance de Mainnet...');
      if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
        console.error('[API/Binance/Trade/Mainnet] Credenciales de Mainnet no configuradas.');
        return NextResponse.json({
          success: false,
          message: 'Credenciales de Binance Mainnet no configuradas en variables de entorno.',
        }, { status: 500 });
      }
      try {
        await exchangeMainnet.loadMarkets();
        const balance = await exchangeMainnet.fetchBalance();
        console.log('[API/Binance/Trade/Mainnet] Balance obtenido.');
        return NextResponse.json({ success: true, balance }, { status: 200 });
      } catch (err: any) {
        console.error('[API/Binance/Trade/Mainnet] Error al obtener balance:', err);
        return NextResponse.json({
          success: false,
          message: 'Error al obtener balance de Mainnet.',
          details: err.message || err.toString(),
        }, { status: 503 });
      }
    }

    // ?marketInfo=BTC/USDT
    if (searchParams.has('marketInfo')) {
      const symbolParam = searchParams.get('marketInfo')!;
      console.log(`[API/Binance/Trade/Mainnet] Obteniendo marketInfo para ${symbolParam}...`);
      if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
        console.error('[API/Binance/Trade/Mainnet] Credenciales de Mainnet no configuradas.');
        return NextResponse.json({
          success: false,
          message: 'Credenciales de Binance Mainnet no configuradas en variables de entorno.',
        }, { status: 500 });
      }
      try {
        await exchangeMainnet.loadMarkets();
        const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;
        const market = exchangeMainnet.markets[ccxtSymbol];
        if (!market) {
          console.warn(`[API/Binance/Trade/Mainnet] Símbolo no encontrado: ${ccxtSymbol}`);
          return NextResponse.json({
            success: false,
            message: `Símbolo no soportado: ${ccxtSymbol}`,
          }, { status: 400 });
        }

        const minAmount = market.limits.amount?.min ?? null;
        console.log(`[API/Binance/Trade/Mainnet] marketInfo ${ccxtSymbol}: minAmount=${minAmount}`);

        let lastPrice: number | null = null;
        let usdtValue: number | null = null;

        if (minAmount !== null) {
          try {
            const ticker = await exchangeMainnet.fetchTicker(ccxtSymbol);
            lastPrice = ticker.last!;
            usdtValue = Number((minAmount * lastPrice).toFixed(8));
          } catch (errTicker) {
            console.warn('[API/Binance/Trade/Mainnet] No se pudo fetchTicker para conversión:', errTicker);
          }
        }

        return NextResponse.json({
          success: true,
          symbol: ccxtSymbol,
          minAmount,
          lastPrice,
          usdtValue,
          message: 'marketInfo obtenido. minAmount según Binance/CCXT.',
        }, { status: 200 });
      } catch (err: any) {
        console.error('[API/Binance/Trade/Mainnet] Error al obtener marketInfo:', err);
        return NextResponse.json({
          success: false,
          message: 'Error al obtener marketInfo.',
          details: err.message || err.toString(),
        }, { status: 500 });
      }
    }

    // Parámetro desconocido
    return NextResponse.json({
      success: false,
      message: 'Parámetros inválidos. Usa ?balance=true o ?marketInfo=SYMBOL',
    }, { status: 400 });
  } catch (err: any) {
    console.error('[API/Binance/Trade/Mainnet] Error en GET genérico:', err);
    return NextResponse.json({
      success: false,
      message: 'Error genérico en endpoint GET.',
      details: err.message || err.toString(),
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const networkType = 'Mainnet';
  let symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price: number | undefined;
  try {
    const body = await req.json();
    symbol = body.symbol;
    type = body.type;
    side = body.side;
    amount = body.amount;
    price = body.price;
    console.log(`[API/Binance/Trade/Mainnet] Recibida solicitud POST: ${JSON.stringify(body)}`);
  } catch (err: any) {
    console.error('[API/Binance/Trade/Mainnet] Error al parsear JSON:', err);
    return NextResponse.json({
      success: false,
      message: 'Formato JSON inválido.',
      details: err.message || err.toString(),
    }, { status: 400 });
  }

  // Validar credenciales
  if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
    console.error('[API/Binance/Trade/Mainnet] Credenciales Mainnet no configuradas.');
    return NextResponse.json({
      success: false,
      message: 'Credenciales de Binance Mainnet no configuradas en variables de entorno.',
    }, { status: 500 });
  }
  // Validar parámetros básicos
  if (!symbol || !type || !side || amount === undefined || amount === null || amount <= 0) {
    console.error('[API/Binance/Trade/Mainnet] Parámetros inválidos:', { symbol, type, side, amount });
    return NextResponse.json({
      success: false,
      message: 'Faltan o son inválidos los parámetros requeridos (symbol, type, side, amount).',
    }, { status: 400 });
  }
  if (type === 'limit' && (price === undefined || price === null || price <= 0)) {
    console.error('[API/Binance/Trade/Mainnet] Precio inválido para orden limit:', price);
    return NextResponse.json({
      success: false,
      message: 'El precio es requerido y debe ser positivo para órdenes limit.',
    }, { status: 400 });
  }
  if (type !== 'market' && type !== 'limit') {
    console.error('[API/Binance/Trade/Mainnet] Tipo de orden no soportado:', type);
    return NextResponse.json({
      success: false,
      message: "Tipo de orden no soportado. Usa 'market' o 'limit'.",
    }, { status: 400 });
  }

  // Cargar mercados y normalizar símbolo
  let ccxtSymbol: string;
  try {
    await exchangeMainnet.loadMarkets();
    ccxtSymbol = symbol.includes('/') ? symbol : `${symbol.replace(/USDT$/i, '')}/USDT`;
    const market = exchangeMainnet.markets[ccxtSymbol];
    if (!market) {
      console.error('[API/Binance/Trade/Mainnet] Símbolo no soportado:', ccxtSymbol);
      return NextResponse.json({
        success: false,
        message: `Símbolo no soportado: ${ccxtSymbol}`,
      }, { status: 400 });
    }
    // **QUITAR validación local de minAmount** para dejar que sea Binance quien responda
    console.log(`[API/Binance/Trade/Mainnet] Parámetros básicos validados para ${ccxtSymbol}. Se omite validación local de mínimo.`);
  } catch (err: any) {
    console.error('[API/Binance/Trade/Mainnet] Error al cargar mercados o normalizar símbolo:', err);
    return NextResponse.json({
      success: false,
      message: 'Error interno validando símbolo.',
      details: err.message || err.toString(),
    }, { status: 500 });
  }

  // Intentar crear orden directamente contra Binance
  try {
    console.log(`[API/Binance/Trade/Mainnet] Creando orden: ${side.toUpperCase()} ${amount} ${ccxtSymbol} (${type.toUpperCase()})${type==='limit'?` @ ${price}`:''}`);
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
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      amount: order.amount,
      price: order.price,
      filled: order.filled,
      remaining: order.remaining,
      cost: order.cost,
    }, { status: 200 });
  } catch (err: any) {
    console.error('[API/Binance/Trade/Mainnet] Error al ejecutar orden:', err);

    // Si Binance rechaza por cantidad mínima, el mensaje típicamente contiene algo como:
    // "InvalidOrder: binance amount of BTC/USDT must be greater than minimum amount precision of 0.00001"
    const msg = err.message || '';
    // Intentar detectar mínimo a partir del mensaje de error
    const minimoExtraido: number | null = (() => {
      const m = msg.match(/minimum amount precision of ([0-9.]+)/i);
      if (m && m[1]) {
        const val = parseFloat(m[1]);
        return isNaN(val) ? null : val;
      }
      // A veces el mensaje puede venir distinto, ajustar regex si difiere
      return null;
    })();

    // Si detectamos mínimo, obtenemos precio y conversiones:
    let lastPrice: number | null = null;
    let usdtValue: number | null = null;
    
    if (minimoExtraido !== null) {
      try {
        const ticker = await exchangeMainnet.fetchTicker(ccxtSymbol);
        lastPrice = ticker.last!;
        usdtValue = Number((minimoExtraido * lastPrice).toFixed(8));
        //borrado de la antigua Conversión USD→COP
        try {
          const ticker = await exchangeMainnet.fetchTicker(ccxtSymbol);
          lastPrice = ticker.last!;
          usdtValue = Number((minimoExtraido * lastPrice).toFixed(8));
          // 🔴 Se eliminó el bloque de conversión USD→COP
        } catch (errTicker) {
          console.warn('[API/Binance/Trade/Mainnet] No se pudo fetchTicker para conversión:', errTicker);
        }

      } catch (errTicker) {
        console.warn('[API/Binance/Trade/Mainnet] No se pudo fetchTicker para conversión:', errTicker);
      }
    }

    // Determinar mensaje de usuario
    let userMessage = 'Error al procesar la orden en Binance Mainnet.';
    let statusCode = 500;
    if (err instanceof ccxt.InsufficientFunds) {
      userMessage = 'Fondos insuficientes en Mainnet.';
      statusCode = 400;
    } else if (err instanceof ccxt.InvalidOrder) {
      // Si extrajimos mínimo, devolvemos info ampliada:
      if (minimoExtraido !== null) {
        userMessage = `Cantidad por debajo del mínimo real de Binance: mínimo = ${minimoExtraido}`;
        statusCode = 400;
      } else {
        userMessage = 'Orden inválida según reglas de Binance (cantidad, precio, etc.).';
        statusCode = 400;
      }
    } else if (err instanceof ccxt.AuthenticationError) {
      userMessage = 'Error de autenticación o permisos en Binance Mainnet.';
      statusCode = 401;
    } else if (err instanceof ccxt.NetworkError) {
      userMessage = 'Error de conexión con Binance. Intenta más tarde.';
      statusCode = 503;
    } else if (err instanceof ccxt.ExchangeError) {
      userMessage = 'Error en el exchange de Binance al procesar la orden.';
    }

    // Responder con detalles y, en su caso, la info de mínimo + conversiones
    const responsePayload: any = {
      success: false,
      message: userMessage,
      details: msg,
    };
    if (minimoExtraido !== null) {
      responsePayload.minAmount = minimoExtraido;
      responsePayload.lastPrice = lastPrice;
      responsePayload.usdtValue = usdtValue;
    }
    return NextResponse.json(responsePayload, { status: statusCode });
  }
}

