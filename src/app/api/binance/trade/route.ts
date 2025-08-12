// src/app/api/binance/trade/route.ts

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
    // ✅ AJUSTE CRÍTICO: Habilitar el ajuste automático de la diferencia horaria
    'adjustForTimeDifference': true,
    // ✅ AJUSTE CRÍTICO: Aumentar la ventana de recepción a 60 segundos (60000ms)
    'recvWindow': 60000,
  },
  enableRateLimit: true,
  timeout: 10000,
  // verbose: true, // Descomentar para ver logs detallados de CCXT en la consola
});

// Nota: en este endpoint usaremos Mainnet únicamente.
// Para Testnet podría usarse otro endpoint separado o bandera isTestnet,
// pero aquí se configura para operaciones reales Mainnet.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Endpoint para obtener el balance de la cuenta de Binance (Mainnet)
    // Uso: GET /api/binance/trade?balance=true
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
        await exchangeMainnet.loadMarkets(); // Cargar mercados para asegurar que la conexión esté viva y autenticada
        const balance = await exchangeMainnet.fetchBalance();
        console.log('[API/Binance/Trade/Mainnet] Balance obtenido.');
        return NextResponse.json({ success: true, balance }, { status: 200 });
      } catch (err: any) {
        console.error('[API/Binance/Trade/Mainnet] Error al obtener balance:', err);
        // Manejo de errores específicos de CCXT para el balance
        if (err instanceof ccxt.AuthenticationError) {
          return NextResponse.json({
            success: false,
            message: 'Error de autenticación al obtener balance. Verifica tus claves API.',
            details: err.message || err.toString(),
          }, { status: 401 });
        } else if (err instanceof ccxt.NetworkError) {
          return NextResponse.json({
            success: false,
            message: 'Error de red al conectar con Binance para obtener balance.',
            details: err.message || err.toString(),
          }, { status: 503 });
        }
        return NextResponse.json({
          success: false,
          message: 'Error al obtener balance de Mainnet.',
          details: err.message || err.toString(),
        }, { status: 500 });
      }
    }

    // Endpoint para obtener información del mercado (mínimos, precisiones, precio) para un símbolo específico
    // Uso: GET /api/binance/trade?marketInfo=SYMBOL (ej. BTCUSDT o BTC/USDT)
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
        await exchangeMainnet.loadMarkets(); // Asegurarse de que los mercados estén cargados
        // Normalizar el símbolo para que CCXT lo entienda (ej. BTCUSDT -> BTC/USDT)
        const ccxtSymbol = symbolParam.includes('/') ? symbolParam : `${symbolParam.replace(/USDT$/i, '')}/USDT`;
        const market = exchangeMainnet.markets[ccxtSymbol];

        if (!market) {
          console.warn(`[API/Binance/Trade/Mainnet] Símbolo no encontrado: ${ccxtSymbol}`);
          return NextResponse.json({
            success: false,
            message: `Símbolo no soportado o inválido: ${ccxtSymbol}`,
          }, { status: 400 });
        }

        // Extraer los límites y precisiones del objeto 'market' proporcionado por CCXT
        const minAmount = market.limits.amount?.min ?? null; // Cantidad mínima de la criptomoneda (ej. 0.00001 BTC)
        const maxAmount = market.limits.amount?.max ?? null; // Cantidad máxima de la criptomoneda
        const minNotional = market.limits.cost?.min ?? null; // Valor total mínimo de la orden en la moneda de cotización (ej. 10 USDT)
        const maxNotional = market.limits.cost?.max ?? null; // Valor total máximo de la orden en la moneda de cotización
        const amountPrecision = market.precision.amount ?? null; // Precisión de decimales para la cantidad (ej. 5 para 0.00001)
        const pricePrecision = market.precision.price ?? null; // Precisión de decimales para el precio (ej. 2 para 107232.50)

        console.log(`[API/Binance/Trade/Mainnet] marketInfo ${ccxtSymbol}: minAmount=${minAmount}, maxAmount=${maxAmount}, minNotional=${minNotional}, maxNotional=${maxNotional}, amountPrecision=${amountPrecision}, pricePrecision=${pricePrecision}`);

        let lastPrice: number | null = null;
        let usdtValue: number | null = null; // Valor en USDT del minAmount

        // Si se pudo obtener el minAmount, intentar obtener el precio actual para calcular su valor en USDT
        if (minAmount !== null) {
          try {
            const ticker = await exchangeMainnet.fetchTicker(ccxtSymbol);
            lastPrice = ticker.last!; // Último precio de cierre/comercio
            usdtValue = Number((minAmount * lastPrice).toFixed(8)); // Calcular el valor en USDT del minAmount
          } catch (errTicker) {
            console.warn('[API/Binance/Trade/Mainnet] No se pudo fetchTicker para conversión (GET):', errTicker);
          }
        }

        // Responder con toda la información del mercado obtenida
        return NextResponse.json({
          success: true,
          symbol: ccxtSymbol,
          minAmount,
          maxAmount,
          minNotional,
          maxNotional,
          amountPrecision,
          pricePrecision,
          lastPrice,
          usdtValue, // Este es el valor en USDT de minAmount, no necesariamente el minNotional
          message: 'marketInfo obtenido. Mínimos, máximos y precisiones según Binance/CCXT.',
        }, { status: 200 });
      } catch (err: any) {
        console.error('[API/Binance/Trade/Mainnet] Error al obtener marketInfo:', err);
        // Manejo de errores específicos para marketInfo
        if (err instanceof ccxt.AuthenticationError) {
          return NextResponse.json({
            success: false,
            message: 'Error de autenticación al obtener marketInfo. Verifica tus claves API.',
            details: err.message || err.toString(),
          }, { status: 401 });
        } else if (err instanceof ccxt.NetworkError) {
          return NextResponse.json({
            success: false,
            message: 'Error de red al conectar con Binance para obtener marketInfo.',
            details: err.message || err.toString(),
          }, { status: 503 });
        }
        return NextResponse.json({
          success: false,
          message: 'Error al obtener marketInfo.',
          details: err.message || err.toString(),
        }, { status: 500 });
      }
    }

    // Respuesta para parámetros GET desconocidos
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
  const networkType = 'Mainnet'; // Definir el tipo de red (Mainnet en este caso)
  let symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price: number | undefined;
  let ccxtSymbol: string = ''; // Inicializar ccxtSymbol aquí para que esté disponible en el catch

  // Paso 1: Parsear el cuerpo de la solicitud JSON
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
      message: 'Formato JSON inválido en el cuerpo de la solicitud.',
      details: err.message || err.toString(),
    }, { status: 400 });
  }

  // Paso 2: Validar credenciales de Binance y parámetros de la orden
  if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
    console.error('[API/Binance/Trade/Mainnet] Credenciales Mainnet no configuradas.');
    return NextResponse.json({
      success: false,
      message: 'Credenciales de Binance Mainnet no configuradas en variables de entorno.',
    }, { status: 500 });
  }
  // Validar que los parámetros esenciales para la orden estén presentes y sean válidos
  if (!symbol || !type || !side || amount === undefined || amount === null || amount <= 0) {
    console.error('[API/Binance/Trade/Mainnet] Parámetros inválidos:', { symbol, type, side, amount });
    return NextResponse.json({
      success: false,
      message: 'Faltan o son inválidos los parámetros requeridos (symbol, type, side, amount).',
    }, { status: 400 });
  }
  // Para órdenes límite, el precio es obligatorio y debe ser positivo
  if (type === 'limit' && (price === undefined || price === null || price <= 0)) {
    console.error('[API/Binance/Trade/Mainnet] Precio inválido para orden limit:', price);
    return NextResponse.json({
      success: false,
      message: 'El precio es requerido y debe ser positivo para órdenes límite.',
    }, { status: 400 });
  }
  // Asegurarse de que el tipo de orden sea 'market' o 'limit'
  if (type !== 'market' && type !== 'limit') {
    console.error('[API/Binance/Trade/Mainnet] Tipo de orden no soportado:', type);
    return NextResponse.json({
      success: false,
      message: "Tipo de orden no soportado. Usa 'market' o 'limit'.",
    }, { status: 400 });
  }

  // Paso 3: Cargar mercados de Binance y normalizar el símbolo de trading
  try {
    await exchangeMainnet.loadMarkets(); // Carga las reglas de todos los mercados
    ccxtSymbol = symbol.includes('/') ? symbol : `${symbol.replace(/USDT$/i, '')}/USDT`; // Normaliza el símbolo (ej. BTCUSDT -> BTC/USDT)
    const market = exchangeMainnet.markets[ccxtSymbol]; // Obtiene la información específica del mercado para el símbolo

    if (!market) {
      console.error('[API/Binance/Trade/Mainnet] Símbolo no soportado:', ccxtSymbol);
      return NextResponse.json({
        success: false,
        message: `Símbolo no soportado o inválido: ${ccxtSymbol}`,
      }, { status: 400 });
    }
    console.log(`[API/Binance/Trade/Mainnet] Parámetros básicos validados para ${ccxtSymbol}.`);
  } catch (err: any) {
    console.error('[API/Binance/Trade/Mainnet] Error al cargar mercados o normalizar símbolo:', err);
    return NextResponse.json({
      success: false,
      message: 'Error interno validando el símbolo de trading.',
      details: err.message || err.toString(),
    }, { status: 500 });
  }

  // Paso 4: Intentar crear la orden de trading directamente contra Binance
  try {
    console.log(`[API/Binance/Trade/Mainnet] Creando orden: ${side.toUpperCase()} ${amount} ${ccxtSymbol} (${type.toUpperCase()})${type === 'limit' ? ` @ ${price}` : ''}`);
    let order;
    if (type === 'market') {
      order = await exchangeMainnet.createMarketOrder(ccxtSymbol, side, amount);
    } else {
      order = await exchangeMainnet.createLimitOrder(ccxtSymbol, side, amount, price!);
    }
    console.log(`[API/Binance/Trade/Mainnet] Orden procesada: ID=${order.id}, status=${order.status}`);
    // Respuesta de éxito si la orden se creó correctamente
    return NextResponse.json({
      success: true,
      message: `Orden ${side} creada en Binance Mainnet.`,
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
    // Paso 5: Manejo de errores si la creación de la orden falla
    console.error('[API/Binance/Trade/Mainnet] Error al ejecutar orden:', err);

    const msg = err.message || ''; // Mensaje de error completo de CCXT

    // ######################################################################
    // ############ INICIO DEL BLOQUE DE AJUSTE PARA OBTENER MÍNIMOS, MÁXIMOS Y PRECISIONES ############
    // ######################################################################

    // Declaración e inicialización de variables para almacenar la información relevante de límites y precisiones.
    // Se inicializan a `null` para evitar errores de TypeScript 'possibly undefined'
    // y para indicar que el valor aún no ha sido determinado.
    let minAmountSuggested: number | null = null; // Mínimo de cantidad del activo base (ej. 0.00001 BTC)
    let maxAmount: number | null = null;          // Máximo de cantidad del activo base
    let minNotional: number | null = null;        // Mínimo nocional (valor total de la orden en moneda de cotización, ej. 5 USDT)
    let maxNotional: number | null = null;        // Máximo nocional (valor total de la orden en moneda de cotización)
    let amountPrecision: number | null = null;    // Precisión de decimales permitida para la cantidad
    let pricePrecision: number | null = null;     // Precisión de decimales permitida para el precio
    let currentMarketPrice: number | null = null; // Precio actual del mercado para el símbolo
    let minAmountUsdtValue: number | null = null; // Valor en USDT del minAmountSuggested

    let binanceErrorCode: number | null = null; // Código de error directo de Binance (ej. -1013)
    let binanceErrorMessage: string | null = null; // Mensaje de error directo de Binance

    // Sub-paso 5.1: Intentar extraer el código y mensaje de error específico de Binance.
    // Esto es útil cuando Binance encapsula sus errores con un formato JSON
    // dentro del mensaje general de CCXT (ej. "binance {"code":-1013,"msg":"..."}").
    const binanceErrorMatch = msg.match(/binance\s*{\s*"code":\s*(-?\d+),\s*"msg":\s*"(.*?)"\s*}/);

    if (binanceErrorMatch && binanceErrorMatch.length >= 3) {
      binanceErrorCode = parseInt(binanceErrorMatch[1], 10);
      binanceErrorMessage = binanceErrorMatch[2];
      console.error(`[API/Binance/Trade/Mainnet] Error directo de Binance: Código ${binanceErrorCode}, Mensaje: ${binanceErrorMessage}`);

      // Si el mensaje de error de Binance indica un fallo por cantidad mínima (MIN_NOTIONAL o MIN_AMOUNT),
      // intentamos extraer el valor numérico directamente de ese mensaje.
      // Se verifica que `binanceErrorMessage` no sea `null` antes de usar `.includes()`.
      if (binanceErrorMessage && (binanceErrorMessage.includes('MIN_NOTIONAL') || binanceErrorMessage.includes('MIN_AMOUNT'))) {
        const minAmountMatch = binanceErrorMessage.match(/minimum is ([0-9.]+)|minimum amount precision of ([0-9.]+)/i);
        if (minAmountMatch && (minAmountMatch[1] || minAmountMatch[2])) {
          minAmountSuggested = parseFloat(minAmountMatch[1] || minAmountMatch[2]);
        }
      }
    }

    // Sub-paso 5.2: Manejo específico para errores de fondos insuficientes o de orden inválida.
    // Si el error original fue por 'Fondos Insuficientes' (ccxt.InsufficientFunds)
    // o por 'Orden Inválida' (ccxt.InvalidOrder),
    // y aún no hemos podido extraer un `minAmountSuggested` del mensaje de error de Binance (o si queremos la info completa),
    // intentamos obtener *todas* las reglas de mercado directamente de la información del símbolo.
    if (err instanceof ccxt.InsufficientFunds || err instanceof ccxt.InvalidOrder) {
        console.log(`[API/Binance/Trade/Mainnet] Error de CCXT (${err.name}). Consultando marketInfo para ${ccxtSymbol} para obtener todos los límites y precisiones...`);
        try {
            // Asegurarse de que los mercados estén cargados para acceder a la información del `market`.
            await exchangeMainnet.loadMarkets();
            const market = exchangeMainnet.markets[ccxtSymbol];

            if (market) {
                // Asignar todos los límites y precisiones obtenidos del objeto 'market'
                minAmountSuggested = market.limits.amount?.min ?? null;
                maxAmount = market.limits.amount?.max ?? null;
                minNotional = market.limits.cost?.min ?? null;
                maxNotional = market.limits.cost?.max ?? null;
                amountPrecision = market.precision.amount ?? null;
                pricePrecision = market.precision.price ?? null;

                console.log(`[API/Binance/Trade/Mainnet] Límites y precisiones de marketInfo obtenidos para ${ccxtSymbol}:`);
                console.log(` - Min Amount: ${minAmountSuggested}, Max Amount: ${maxAmount}`);
                console.log(` - Min Notional: ${minNotional}, Max Notional: ${maxNotional}`);
                console.log(` - Amount Precision: ${amountPrecision}, Price Precision: ${pricePrecision}`);
            }
        } catch (marketInfoErr: any) {
            // Registra una advertencia si la consulta de marketInfo falla durante el manejo de error.
            console.warn(`[API/Binance/Trade/Mainnet] Advertencia: No se pudo obtener marketInfo completo para ${ccxtSymbol} durante manejo de error:`, marketInfoErr.message);
        }
    }

    // Sub-paso 5.3: Si se obtuvo un `minAmountSuggested` (ya sea del error o por la consulta a marketInfo),
    // se procede a obtener el precio actual del mercado para calcular su valor en USDT.
    if (minAmountSuggested !== null && ccxtSymbol) {
      try {
        const ticker = await exchangeMainnet.fetchTicker(ccxtSymbol); // Consulta el último precio del ticker.
        currentMarketPrice = ticker.last!;
        // Calcula el valor en USDT del `minAmountSuggested` usando el precio actual.
        minAmountUsdtValue = Number((minAmountSuggested * currentMarketPrice).toFixed(8));
        console.log(`[API/Binance/Trade/Mainnet] Valor de minAmount sugerido: ${minAmountSuggested}, Valor en USDT: ${minAmountUsdtValue}`);
      } catch (errTicker) {
        // Registra una advertencia si no se puede obtener el ticker para el cálculo.
        console.warn('[API/Binance/Trade/Mainnet] No se pudo fetchTicker para conversión de mínimo:', errTicker);
      }
    }

    // ######################################################################
    // ############# FIN DEL BLOQUE DE AJUSTE PARA OBTENER MÍNIMOS, MÁXIMOS Y PRECISIONES ############
    // ######################################################################


    // Paso 6: Determinar el mensaje de usuario y el código de estado HTTP adecuado
    let userMessage = 'Error al procesar la orden en Binance Mainnet.';
    let statusCode = 500; // Por defecto, un error interno del servidor.

    if (err instanceof ccxt.InsufficientFunds) {
      userMessage = 'Fondos insuficientes en Mainnet. No tienes suficiente balance para esta operación.';
      statusCode = 400; // Código de estado 'Bad Request' para errores del cliente (ej. fondos).
    } else if (err instanceof ccxt.InvalidOrder) {
      // Si el error es una orden inválida y se obtuvo información de límites/precisiones, se proporciona más detalle.
      userMessage = 'Orden inválida según las reglas de Binance.';
      if (minAmountSuggested !== null) {
        userMessage += ` La cantidad mínima requerida es ${minAmountSuggested}.`;
        if (minAmountUsdtValue !== null) {
          userMessage += ` (Aproximadamente ${minAmountUsdtValue} USDT)`;
        }
      }
      if (minNotional !== null) {
        userMessage += ` El valor total mínimo de la orden (notional) es ${minNotional} USDT.`;
      }
      if (amountPrecision !== null) {
        userMessage += ` Precisión de cantidad: ${amountPrecision} decimales.`;
      }
      if (pricePrecision !== null) {
        userMessage += ` Precisión de precio: ${pricePrecision} decimales.`;
      }
      statusCode = 400;
    } else if (err instanceof ccxt.AuthenticationError) {
      userMessage = 'Error de autenticación o permisos en Binance Mainnet. Verifica tus claves API.';
      statusCode = 401; // Código de estado 'Unauthorized'.
    } else if (err instanceof ccxt.NetworkError) {
      userMessage = 'Error de conexión con Binance. Intenta más tarde.';
      statusCode = 503; // Código de estado 'Service Unavailable'.
    } else if (err instanceof ccxt.ExchangeError) {
      userMessage = 'Error en el exchange de Binance al procesar la orden.';
      statusCode = 400; // Generalmente 'Bad Request' para errores de reglas de negocio del exchange.
    }

    // Paso 7: Construir y responder con el payload final del error
    const responsePayload: any = {
      success: false,
      message: userMessage, // Mensaje amigable para el usuario.
      details: msg, // Mensaje de error completo y técnico de CCXT.
      binanceErrorCode: binanceErrorCode, // Código de error directo de Binance (si extraído).
      binanceErrorMessage: binanceErrorMessage, // Mensaje de error directo de Binance (si extraído).
      minAmountSuggested: minAmountSuggested, // Cantidad mínima sugerida extraída (o del marketInfo).
      maxAmount: maxAmount,                  // Cantidad máxima obtenida del marketInfo (si disponible).
      minNotional: minNotional,             // Mínimo notional obtenido del marketInfo (si disponible).
      maxNotional: maxNotional,             // Máximo notional obtenido del marketInfo (si disponible).
      amountPrecision: amountPrecision,      // Precisión de cantidad obtenida del marketInfo (si disponible).
      pricePrecision: pricePrecision,        // Precisión de precio obtenida del marketInfo (si disponible).
      currentMarketPrice: currentMarketPrice, // Precio actual del mercado (si obtenido).
      minAmountUsdtValue: minAmountUsdtValue, // Valor en USDT de la cantidad mínima sugerida (si calculado).
    };

    return NextResponse.json(responsePayload, { status: statusCode });
  }
}
