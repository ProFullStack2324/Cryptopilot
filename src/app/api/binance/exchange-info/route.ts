// src/app/api/binance/exchange-info/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Reutiliza la configuración de CCXT. Considera separarla en un archivo común
// si la usas en varios endpoints de API para evitar repetición.
// Es crucial que esta configuración sea la misma que usas en trade/route.ts
// y balance/route.ts para asegurar que usas la misma red (Mainnet/Testnet)
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY, // Asegúrate de tener estas claves en .env.local
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
       // Configura el tipo por defecto si es necesario (ej. 'spot')
       'defaultType': 'spot',
  },
  // Por defecto usa la API de producción (Mainnet)
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY, // Asegúrate de tener estas claves en .env.local
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    options: {
       // Configura el tipo por defecto si es necesario (ej. 'spot')
        'defaultType': 'spot',
    },
    urls: {
      // Asegúrate de usar las URLs correctas para la Testnet de Binance que necesites (Spot o Futures)
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


// Usaremos GET para obtener información del exchange
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Permitir especificar si usar Testnet a través de un parámetro de query
  const isTestnetParam = searchParams.get('isTestnet');
  const isTestnet = isTestnetParam?.toLowerCase() === 'true';

  // Opcional: Permitir especificar un símbolo particular
  const symbolParam = searchParams.get('symbol'); // Ejemplo: 'BTCUSDT' (formato Binance)

  const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
  const networkType = isTestnet ? 'Testnet' : 'Mainnet';

  console.log(`[API/Binance/ExchangeInfo] Recibida solicitud de info del exchange en ${networkType}${symbolParam ? ` para ${symbolParam}` : ''}.`);


  // --- Obtener la información del Exchange ---
  try {
    // 1. Validar Credenciales antes de intentar conectar
     if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
        console.error(`[API/Binance/ExchangeInfo] Error: Las credenciales de ${networkType} no están configuradas.`);
        return NextResponse.json({
          success: false,
          message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
        }, { status: 500 });
      }
      console.log(`[API/Binance/ExchangeInfo] Credenciales de ${networkType} cargadas correctamente.`);


    // 2. Cargar los mercados/reglas del exchange
    // Esto puede ser costoso. CCXT a menudo cachea la información después de la primera llamada,
    // pero en un entorno serverless o con reinicios frecuentes, puede que necesites cacheo manual.
    console.log(`[API/Binance/ExchangeInfo] Solicitando info del exchange (loadMarkets) a CCXT en ${networkType}...`);

    // loadMarkets() carga información para TODOS los símbolos por defecto.
    // Si necesitas solo info de símbolos específicos, puedes pasar un array de símbolos a loadMarkets,
    // pero asegúrate de tener todos los símbolos que tu app podría necesitar.
    // Cargar todos es más simple inicialmente.
    await exchangeToUse.loadMarkets();

    console.log(`[API/Binance/ExchangeInfo] Info del exchange obtenida.`);

    let responseData = null;

    if (symbolParam) {
        // Si se pidió un símbolo específico, buscar su información
        // CCXT almacena los mercados en exchange.markets indexados por el símbolo en formato de la API (ej. 'BTCUSDT')
        const marketInfo = exchangeToUse.market(symbolParam); // Usa exchange.market() que es más seguro que acceder directamente por índice

        if (marketInfo) {
             responseData = marketInfo;
              console.log(`[API/Binance/ExchangeInfo] Encontrada información detallada para el símbolo ${symbolParam}.`);
        } else {
             console.warn(`[API/Binance/ExchangeInfo] Símbolo ${symbolParam} no encontrado en los mercados cargados. Esto puede indicar que el símbolo no existe o no está activo en ${networkType}.`);
              return NextResponse.json({
                  success: false,
                  message: `Información no encontrada para el símbolo ${symbolParam}. Asegúrate de que es válido en ${networkType}.`,
                  details: `Símbolo ${symbolParam} no encontrado después de cargar los mercados del exchange.`
              }, { status: 404 }); // 404 Not Found es apropiado aquí
        }


    } else {
        // Si no se pidió un símbolo específico, devolver todos los mercados (puede ser grande)
        // Convertir el objeto markets a un array si es más fácil de consumir en el frontend,
        // o devolver el objeto directamente. Devolver el objeto es más directo si buscas por clave.
        responseData = exchangeToUse.markets; // Objeto { 'BTCUSDT': {...}, 'ETHUSDT': {...}, ...}
        console.log(`[API/Binance/ExchangeInfo] Devolviendo información para ${Object.keys(responseData).length} mercados.`);
    }


    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Información del exchange de Binance ${networkType} obtenida con éxito${symbolParam ? ` para ${symbolParam}` : ''}.`,
      data: responseData, // Devolvemos la info del mercado (o todos los mercados)
      // El objeto 'data' contendrá las reglas bajo 'limits', 'precision', etc.
    });

  } catch (error: any) {
    console.error(`[API/Binance/ExchangeInfo] Error al obtener info del exchange con CCXT en ${networkType}:`, error);

    // --- Manejo de Errores Específicos de Binance/CCXT para la Info del Exchange ---
    let userMessage = `Error al obtener la información del exchange de Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;

    // CCXT puede lanzar errores de red, autenticación, o del exchange al cargar mercados
    if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/ExchangeInfo] Error de Red al intentar conectar con Binance ${networkType} para info del exchange.`);
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente

    } else if (error instanceof ccxt.AuthenticationError) {
         console.error(`[API/Binance/ExchangeInfo] Error de Autenticación en ${networkType} al obtener info del exchange.`);
         userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
         details = error.message;
         statusCode = 401; // No autorizado

    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/ExchangeInfo] Error genérico del Exchange en ${networkType} al obtener info.`);
         userMessage = "Ocurrió un error en el exchange de Binance al obtener la información del mercado.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/ExchangeInfo] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos

    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/ExchangeInfo] Error inesperado en ${networkType} al obtener info del exchange:`, error);
        userMessage = "Ocurrió un error inesperado al obtener la información del exchange.";
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
