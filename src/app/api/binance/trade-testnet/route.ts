// src/app/api/binance/trade-testnet/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Definir una interfaz para la estructura de la solicitud (request body)
interface TradeRequest {
  symbol: string; // Ejemplo: 'BTC/USDT'
  type: 'market' | 'limit'; // Tipo de orden: 'market' o 'limit'
  side: 'buy' | 'sell'; // Lado de la orden: 'buy' o 'sell'
  amount: number; // Cantidad a comprar/vender (ej. 0.001 BTC)
  price?: number; // Precio límite (opcional, solo para órdenes 'limit')
  // No necesitamos isTestnet aquí, ya que este endpoint es solo para Testnet
}

// --- Configuración de CCXT para la Red de Prueba (Testnet) ---
// Asegúrate de tener las claves API de Testnet configuradas en tus variables de entorno (.env.local)
// BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    options: {
        // Configura el tipo por defecto (spot o future) para Testnet según tu necesidad
        // 'defaultType': 'future',
        // 'defaultType': 'spot',
    },
    urls: {
        // --- URLs de la API de Testnet ---
        // Es CRUCIAL que configures las URLs correctas para la Testnet de Binance que estés utilizando (Spot o Futures).
        // Consulta la documentación de Binance para las URLs exactas.

        // Ejemplo para Spot Testnet:
         'api': {
           'public': 'https://testnet.binance.vision/api/',
           'private': 'https://testnet.binance.vision/api/',
         },
        // Ejemplo para Futures USD-M Testnet:
        // 'api': {
        //   'public': 'https://testnet.binancefuture.com/fapi/v1',
        //   'private': 'https://testnet.binancefuture.com/fapi/v1',
        // },
    },
    // setSandboxMode(true) a menudo no es necesario si especificas las URLs de testnet
});
// --- Fin Configuración CCXT Testnet ---


export async function POST(req: Request) {
  let symbol, type, side, amount, price;
  const networkType = 'Testnet'; // Definido fijo para este endpoint

  try {
      const requestBody: TradeRequest = await req.json();
      ({ symbol, type, side, amount, price } = requestBody); // No se desestructura isTestnet aquí
      console.log(`[API/Binance/Trade/Testnet] Recibida solicitud para ${side.toUpperCase()} ${amount} de ${symbol} en ${networkType}`);

  } catch (jsonError: any) {
      console.error("[API/Binance/Trade/Testnet] Error al parsear el cuerpo de la solicitud:", jsonError);
      return NextResponse.json({
        success: false,
        message: "Error al procesar la solicitud. Formato JSON inválido."
      }, { status: 400 });
  }


  // --- Validación de Credenciales de Testnet ---
  if (exchangeTestnet.apiKey === undefined || exchangeTestnet.secret === undefined) {
    console.error(`[API/Binance/Trade/Testnet] Error: Las credenciales de ${networkType} no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
    }, { status: 500 });
  }
    console.log(`[API/Binance/Trade/Testnet] Credenciales de ${networkType} cargadas correctamente.`);


  // --- Validación de Parámetros de la Orden ---
  if (!symbol || !type || !side || amount === undefined || amount === null || amount <= 0) {
    console.error("[API/Binance/Trade/Testnet] Error: Faltan o son inválidos los parámetros requeridos (symbol, type, side, amount).");
    return NextResponse.json({
      success: false,
      message: "Faltan o son inválidos los parámetros requeridos (symbol, type, side, amount)."
    }, { status: 400 });
  }

  if (type === 'limit' && (price === undefined || price === null || price <= 0)) {
    console.error("[API/Binance/Trade/Testnet] Error: Precio requerido y válido para orden límite.");
    return NextResponse.json({
      success: false,
      message: "El precio es requerido y debe ser un valor positivo para órdenes límite."
    }, { status: 400 });
  }

  if (type !== 'market' && type !== 'limit') {
       console.error(`[API/Binance/Trade/Testnet] Error: Tipo de orden no soportado: ${type}`);
       return NextResponse.json({
         success: false,
         message: "Tipo de orden no soportado. Usa 'market' o 'limit'."
       }, { status: 400 });
  }
    console.log("[API/Binance/Trade/Testnet] Parámetros de la orden validados.");


  // --- Creación de la Orden usando CCXT en Testnet ---
  try {
    console.log(`[API/Binance/Trade/Testnet] Enviando orden a CCXT: ${side.toUpperCase()} ${amount} de ${symbol} de tipo ${type.toUpperCase()}${type === 'limit' ? ` @ ${price}` : ''}`);

    let order;
    if (type === 'market') {
      order = await exchangeTestnet.createMarketOrder(symbol, side, amount);
    } else { // type === 'limit'
      order = await exchangeTestnet.createLimitOrder(symbol, side, amount, price!);
    }

    console.log(`[API/Binance/Trade/Testnet] Orden procesada por CCXT. ID: ${order.id}, Estado: ${order.status}`);

    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Orden de ${side} creada con éxito en Binance ${networkType}.`,
      orderId: order.id,
      status: order.status,
      symbol: order.symbol, // Incluir datos clave de la orden
      side: order.side,
      type: order.type,
      amount: order.amount,
      price: order.price, // Precio ejecutado o solicitado
      filled: order.filled, // Cantidad ejecutada
      remaining: order.remaining, // Cantidad restante
      cost: order.cost, // Costo total (para compras) o ingreso (para ventas)
      // Puedes añadir más campos si son relevantes para tu frontend
    });

  } catch (error: any) {
    console.error("[API/Binance/Trade/Testnet] Error al ejecutar la orden con CCXT:", error);

    // --- Manejo de Errores Específicos de Binance/CCXT en Testnet ---
    let userMessage = `Error al procesar la orden en Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;

    // Intentar extraer información detallada del error de CCXT, que a menudo encapsula errores de la API de Binance
    if (error instanceof ccxt.InsufficientFunds) {
         console.warn(`[API/Binance/Trade/Testnet] Detectado error de Fondos Insuficientes.`);
         userMessage = "Fondos Insuficientes en tu cuenta de Binance Testnet para realizar esta operación.";
         details = error.message;
         statusCode = 400; // Error del cliente
    } else if (error instanceof ccxt.InvalidOrder) {
         console.warn(`[API/Binance/Trade/Testnet] Detectado error de Orden Inválida.`);
         userMessage = "Parámetros de la orden inválidos según las reglas de Binance Testnet (ej. cantidad mínima, precio).";
         details = error.message;
         statusCode = 400; // Error del cliente
         // Intentar obtener código de error específico de Binance si está disponible en el error de CCXT
         if (error.message.includes('code=')) {
             const codeMatch = error.message.match(/code=(-?\d+)/);
             if (codeMatch && codeMatch[1]) {
                 binanceErrorCode = parseInt(codeMatch[1], 10);
                 console.warn(`[API/Binance/Trade/Testnet] Código de error de Binance extraído: ${binanceErrorCode}`);
             }
         }

    } else if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/Trade/Testnet] Error de Red al intentar conectar con Binance Testnet.`);
        userMessage = "Error de conexión con la API de Binance Testnet. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente

    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/Trade/Testnet] Error genérico del Exchange.`);
         userMessage = "Ocurrió un error en el exchange de Binance Testnet al procesar la orden.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/Trade/Testnet] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos

    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/Trade/Testnet] Error inesperado:`, error);
        userMessage = "Ocurrió un error inesperado al procesar la orden en Testnet.";
        details = error.message || JSON.stringify(error);
        statusCode = 500;
    }


    // --- Respuesta de Error ---
    return NextResponse.json({
      success: false,
      message: userMessage, // Mensaje amigable para el usuario
      details: details,     // Detalles técnicos del error (para depuración)
      binanceErrorCode: binanceErrorCode, // Código de error específico de Binance si se pudo extraer
      // Puedes añadir otros campos de error si son útiles
    }, { status: statusCode }); // Código de estado HTTP apropiado

  }
}
