// src/app/api/binance/trade-history/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
// --- SECCIÓN MODIFICADA: Eliminamos la importación de tipos y no referenciamos ccxt.Trade directamente ---
// No importamos tipos directamente
// --- FIN SECCIÓN MODIFICADA ---


// Definir una interfaz para la estructura de la solicitud (request body)
interface TradeHistoryRequest {
  symbol?: string; // Opcional: Símbolo específico (ej. 'BTC/USDT'). Si no se proporciona, intentará obtener para todos los símbolos (puede ser lento/limitado por la API).
  isTestnet?: boolean; // Opcional: Bandera para indicar si usar la red de prueba (por defecto false).
  since?: number; // Opcional: Timestamp en milisegundos para obtener trades desde esa fecha.
  limit?: number; // Opcional: Límite de trades a obtener (la API de Binance tiene límites por defecto y máximos).
  // Puedes añadir otros parámetros que soporten fetchMyTrades si los necesitas, como 'params' para opciones específicas del exchange.
}

// --- Configuración de CCXT para Mainnet y Testnet ---
// Asegúrate de tener las claves API configuradas en tus variables de entorno (.env.local)
// BINANCE_API_KEY, BINANCE_SECRET_KEY (para Mainnet)
// BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY (para Testnet)

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    // Configura el tipo por defecto (spot o future) si es necesario para obtener el historial correcto
     'defaultType': 'spot', // Historial de trades de Spot
    // 'defaultType': 'future', // Historial de trades de Futuros
  },
  // Por defecto usa la API de producción (Mainnet)
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    options: {
        // Configura el tipo por defecto (spot o future) para Testnet
         'defaultType': 'spot', // Historial de trades de Spot Testnet
        // 'defaultType': 'future', // Historial de trades de Futuros Testnet
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
        /* 
        'api': {
           'public': 'https://testnet.binancefuture.com/fapi/v1',
           'private': 'https://testnet.binancefuture.com/fapi/v1',
         },
         */
    },
});
// --- Fin Configuración CCXT ---


// Usaremos POST para poder enviar parámetros como symbol, isTestnet, since, limit
export async function POST(req: Request) {
  let symbol: string | undefined = undefined;
  let isTestnet: boolean = false;
  let since: number | undefined = undefined;
  let limit: number | undefined = undefined;

  console.log(`[API/Binance/TradeHistory] Solicitud POST recibida.`);

  try {
      const requestBody: TradeHistoryRequest = await req.json();
      // Desestructurar y asignar valores con valores por defecto si no están presentes
      ({
        symbol = undefined,
        isTestnet = false,
        since = undefined,
        limit = undefined
      } = requestBody);

      console.log(`[API/Binance/TradeHistory] Parámetros de solicitud parseados: Símbolo='${symbol || 'TODOS'}', Testnet=${isTestnet}, Since=${since}, Limit=${limit}`);

  } catch (jsonError: any) {
      console.error("[API/Binance/TradeHistory] Error al parsear el cuerpo de la solicitud JSON:", jsonError);
      return NextResponse.json({
        success: false,
        message: "Error al procesar la solicitud. Formato JSON inválido."
      }, { status: 400 });
  }


  const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
  const networkType = isTestnet ? 'Testnet' : 'Mainnet';

  console.log(`[API/Binance/TradeHistory] Usando configuración para la red: ${networkType}`);

  // --- Validación de Credenciales ---
  if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
    console.error(`[API/Binance/TradeHistory] Error: Las credenciales de ${networkType} no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
    }, { status: 500 });
  }
    console.log(`[API/Binance/TradeHistory] Credenciales de ${networkType} cargadas correctamente.`);


  // --- Obtener Historial de Trades usando CCXT ---
  try {
    console.log(`[API/Binance/TradeHistory] Solicitando historial de trades a CCXT en ${networkType} para símbolo: ${symbol || 'TODOS'}. Since: ${since}, Limit: ${limit}`);

    // ccxt.fetchMyTrades(symbol, since, limit, params)
    // symbol: string | undefined
    // since: number | undefined (timestamp en ms)
    // limit: number | undefined (cantidad de trades)
    // params: any (opciones específicas del exchange)

    // Petición a la API de Binance a través de CCXT
    // --- INICIO SECCIÓN MODIFICADA: Aserción de tipo a any[] ---
    // Asertamos el resultado como any[] para evitar errores de tipo con ccxt.Trade
    const trades = await exchangeToUse.fetchMyTrades(symbol, since, limit) as any[];
    // --- FIN SECCIÓN MODIFICADA: Aserción de tipo a any[] ---


    console.log(`[API/Binance/TradeHistory] Historial de trades obtenido de CCXT en ${networkType}. Cantidad: ${trades ? trades.length : 0}`);
    // console.log(JSON.stringify(trades, null, 2)); // Log detallado de los trades crudos si es necesario para depurar

    // --- INICIO SECCIÓN MODIFICADA: Formateo de Resultados con aserción a any dentro del map ---
    // En el map, asertamos cada trade a any para poder acceder a sus propiedades
    const formattedTrades = trades.map((trade: any) => { // <-- CORRECCIÓN AQUÍ (Anotación a any)
        console.log(`[API/Binance/TradeHistory] Formateando trade (RAW):`, trade);

        // Acceder a las propiedades, asumiendo que existen o manejando undefined/null
        const orderId = trade.order;

        // Asegurar que los valores son string antes de parseFloat
        // Usamos (valor ?? '0').toString() para seguridad, asumiendo que las propiedades existen
        const priceStr = (trade.price ?? '0').toString();
        const amountStr = (trade.amount ?? '0').toString();
        const costStr = (trade.cost ?? '0').toString();

        // Manejar fee.cost y fee.rate que pueden ser undefined o null.
        // trade.fee puede ser undefined, por eso usamos encadenamiento opcional '?.'
        const feeCostStr = (trade.fee?.cost ?? '0').toString();

        // Manejar fee.rate: puede ser Num | undefined. Solo convertir a string si existe.
        // Aseguramos que trade.fee existe Y trade.fee.rate no es undefined/null antes de llamar a toString()
        const feeRate = trade.fee?.rate;
        const feeRateStr = (feeRate !== undefined && feeRate !== null) ? feeRate.toString() : undefined;


        const formattedTrade = {
          id: trade.id, // Asumimos string
          orderId: orderId as string | undefined, // Asumimos string | undefined
          symbol: trade.symbol as string, // Asumimos string
          timestamp: trade.timestamp as number, // Asumimos number
          datetime: trade.datetime as string, // Asumimos string
          side: trade.side as string, // Asumimos string ('buy' o 'sell')
          type: trade.type as string | undefined, // Asumimos string | undefined ('market' o 'limit')
          price: parseFloat(priceStr), // Resulta en number
          amount: parseFloat(amountStr), // Resulta en number
          cost: parseFloat(costStr), // Resulta en number
          fee: trade.fee ? { // Si trade.fee existe, formateamos
              cost: parseFloat(feeCostStr), // Resulta en number
              currency: trade.fee.currency as string | undefined, // Asumimos string | undefined
              rate: feeRateStr ? parseFloat(feeRateStr) : undefined // Resulta en number | undefined
          } : undefined, // Si trade.fee no existe, fee es undefined
          // Puedes añadir más propiedades y asertar sus tipos aquí si es necesario
          // Ejemplo: originalTradeData: trade, // Incluir datos crudos (any)
        };
        console.log(`[API/Binance/TradeHistory] Trade formateado:`, formattedTrade);
        return formattedTrade;
    });
    // --- FIN SECCIÓN MODIFICADA: Formateo de Resultados con aserción a any dentro del map ---


    console.log(`[API/Binance/TradeHistory] ${formattedTrades.length} trades formateados.`);
    // console.log(JSON.stringify(formattedTrades, null, 2)); // Log de los trades formateados si es necesario

    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Historial de trades obtenido con éxito de Binance ${networkType}.`,
      trades: formattedTrades, // Devolvemos los trades formateados
      // Puedes devolver información de paginación si la API la proporciona y la necesitas
    });

  } catch (error: any) {
    console.error(`[API/Binance/TradeHistory] Error al obtener historial de trades con CCXT en ${networkType}:`, error);

    // --- Manejo de Errores Específicos de Binance/CCXT ---
    let userMessage = `Error al obtener el historial de trades de Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;

    // ccxt encapsula errores de la API de Binance
    if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/TradeHistory] Error de Red al intentar conectar con Binance ${networkType}.`);
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente

    } else if (error instanceof ccxt.AuthenticationError) {
         console.error(`[API/Binance/TradeHistory] Error de Autenticación en ${networkType}.`);
         userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
         details = error.message;
         statusCode = 401; // No autorizado

    } else if (error instanceof ccxt.ArgumentsRequired) {
        console.warn(`[API/Binance/TradeHistory] Error: Argumentos Requeridos faltantes.`);
        userMessage = "Faltan argumentos necesarios para obtener el historial de trades (ej. símbolo).";
        details = error.message;
        statusCode = 400; // Bad Request

    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/TradeHistory] Error genérico del Exchange en ${networkType}.`);
         userMessage = "Ocurrió un error en el exchange de Binance al obtener el historial de trades.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/TradeHistory] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos

    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/TradeHistory] Error inesperado en ${networkType}:`, error);
        userMessage = "Ocurrió un error inesperado al obtener el historial de trades.";
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
