// src/app/api/binance/klines/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { MarketPriceDataPoint } from '@/lib/types'; // Asegúrate de que esta interfaz sea correcta


// --- Configuración Dual de CCXT para Klines ---
// Asegúrate de que tus claves API estén en variables de entorno (ej. .env.local)
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BINANCE_TESTNET_API_KEY = process.env.BINANCE_TESTNET_API_KEY; // Necesario para testnet
const BINANCE_TESTNET_SECRET_KEY = process.env.BINANCE_TESTNET_SECRET_KEY; // Necesario para testnet


// Configura la instancia de Binance para la red principal
const exchangeMainnet = new ccxt.binance({
  apiKey: BINANCE_API_KEY,
  secret: BINANCE_SECRET_KEY,
   options: {
     // Configura el tipo por defecto (spot o future) si es necesario para obtener los klines correctos de Mainnet
     //'defaultType': 'future', // Ejemplo: Para operar en futuros USD-M en Mainnet
     'defaultType': 'spot', // Ejemplo: Para operar en Spot en Mainnet
   },
  timeout: 10000, // Aumentar el timeout a 10 segundos
  enableRateLimit: true, // Habilita la limitación de tasa interna de ccxt
});

// Configura la instancia de Binance para la red de prueba (Testnet)
const exchangeTestnet = new ccxt.binance({
    apiKey: BINANCE_TESTNET_API_KEY,
    secret: BINANCE_TESTNET_SECRET_KEY,
    options: {
         // Configura el tipo por defecto (spot o future) para Testnet
        'defaultType': 'future', // Ejemplo: Para operar en futuros USD-M en Testnet
        //'defaultType': 'spot', // Ejemplo: Para operar en Spot en Testnet
    },
    urls: {
        // --- URLs de la API de Testnet ---
        // Es CRUCIAL que configures las URLs correctas para la Testnet de Binance que estés utilizando (Spot o Futures).
        // Consulta la documentación de Binance para las URLs exactas.
        // Estas URLs son ejemplos.

        // Ejemplo para Futuros USD-M Testnet (APIs públicas y privadas si fetchOHLCV las requiere):
         'api': {
           'fapiPublic': 'https://testnet.binancefuture.com/fapi/v1',
           'fapiPrivate': 'https://testnet.binancefuture.com/fapi/v1', // Algunos métodos públicos pueden usar el endpoint privado
         },
        // Ejemplo para Spot Testnet (APIs públicas y privadas):
        // 'api': {
        //    'public': 'https://testnet.binance.vision/api/',
        //    'private': 'https://testnet.binance.vision/api/',
        /* ,*/
    },
    timeout: 10000, // Aumentar el timeout
    enableRateLimit: true, // Habilita la limitación de tasa
});
// --- Fin Configuración Dual de CCXT para Klines ---


export async function GET(request: Request) {
  console.log('[API Klines] Solicitud GET entrante.');

  // --- INICIO SECCIÓN MODIFICADA: Declaración de variables al inicio ---
  let symbol: string | null = null; // Declarar symbol aquí
  let timeframe: string | null = null; // Declarar timeframe aquí
  let limitParam: string | null = null; // Declarar limitParam aquí
  let isTestnet: boolean = false; // Declarar isTestnet aquí con valor por defecto
  let networkType: string = 'Mainnet'; // Declarar networkType aquí con valor por defecto
  let limit: number | undefined; // Declarar limit aquí
  // --- FIN SECCIÓN MODIFICADA: Declaración de variables al inicio ---


  try {
    const { searchParams } = new URL(request.url);
    // --- INICIO SECCIÓN MODIFICADA: Asignar valores a variables ya declaradas ---
    symbol = searchParams.get('symbol'); // Ej: BTCUSDT
    timeframe = searchParams.get('timeframe'); // Ej: 1m, 5m, 1h, 1d
    limitParam = searchParams.get('limit'); // Cantidad de velas a obtener
    isTestnet = searchParams.get('isTestnet')?.toLowerCase() === 'true'; // Leer el parámetro isTestnet=true/false
    // --- FIN SECCIÓN MODIFICADA: Asignar valores a variables ya declaradas ---


    // --- INICIO SECCIÓN MODIFICADA: Seleccionar Exchange y definir networkType ---
    const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
    networkType = isTestnet ? 'Testnet' : 'Mainnet'; // Asignar valor a networkType ya declarada
    console.log(`[API Klines] Usando configuración para la red: ${networkType}`);
    // --- FIN SECCIÓN MODIFICADA: Seleccionar Exchange y definir networkType ---


    if (!symbol || !timeframe) {
      console.warn(`[API Klines] Error 400 en ${networkType}: Parámetros \"symbol\" y \"timeframe\" son requeridos.`);
      return NextResponse.json(
        { success: false, message: `Parámetros \"symbol\" y \"timeframe\" son requeridos para obtener klines en ${networkType}.` },
        { status: 400 }
      );
    }

     // --- INICIO SECCIÓN MODIFICADA: Validación de Credenciales (si fetchOHLCV requiere autenticación) ---
     // Aunque fetchOHLCV a menudo es público, si tu configuración requiere API keys, valida:
     if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
       console.error(`[API Klines] Error: Las credenciales de ${networkType} no están configuradas.`);
       return NextResponse.json({
         success: false,
         message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
       }, { status: 500 });
     }
      console.log(`[API Klines] Credenciales de ${networkType} cargadas correctamente.`);
     // --- FIN SECCIÓN MODIFICADA: Validación de Credenciales ---


    // --- INICIO SECCIÓN MODIFICADA: Parsear limitParam ---
    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        console.warn(`[API Klines] Advertencia en ${networkType}: Límite inválido \"${limitParam}\". Usando predeterminado.`);
        limit = undefined; // Dejar que ccxt use su límite predeterminado
      } else {
        limit = parsedLimit;
      }
    }
    // --- FIN SECCIÓN MODIFICADA: Parsear limitParam ---


    // Normalizar el símbolo para ccxt (ej: BTCUSDT -> BTC/USDT)
    // Esto es robusto, ya que ccxt espera \"BTC/USDT\" para pares futuros.
    // --- INICIO SECCIÓN MODIFICADA: Normalizar Símbolo ---
    const ccxtSymbol = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase().replace('USDT', '')}/USDT`;
    // --- FIN SECCIÓN MODIFICADA: Normalizar Símbolo ---

    console.log(`[API Klines] Procesando solicitud para: ${ccxtSymbol} en ${networkType}, timeframe: ${timeframe}, limit: ${limit || 'ccxt default'}.`);

    // Fetch the OHLCV (candlestick) data using the selected exchange instance
    const klines = await exchangeToUse.fetchOHLCV(
      ccxtSymbol,
      timeframe,
      undefined, // since: No lo especificamos para obtener los más recientes
      limit // limit: Usar el valor del query param o el predeterminado de ccxt/Binance
    );

    if (!klines || klines.length === 0) {
      console.warn(`[API Klines] No se recibieron klines para ${ccxtSymbol} (${timeframe}) en ${networkType}.`);
      return NextResponse.json(
        { success: true, message: `No se encontraron datos de klines para ${ccxtSymbol} (${timeframe}) en ${networkType}.`, klines: [] }, // Indicar success: true si es solo falta de datos
        { status: 200 }
      );
    }

    console.log(`[API Klines] Klines recibidos de Binance ${networkType}: ${klines.length} puntos.`);

    // Transformación y Tipado
    // Asertar el array de klines a any[] para facilitar el acceso a los elementos
    const transformedKlines: MarketPriceDataPoint[] = (klines as any[]).map(kline => {
      if (!Array.isArray(kline) || kline.length < 6) {
        console.warn(`[API Klines] Dato kline incompleto o malformado en ${networkType}, saltando:`, kline);
        return null; // Retornar null para filtrar más tarde
      }

      // Los elementos de kline son: [timestamp, open, high, low, close, volume]
      const timestampMs = kline[0];
      const openPrice = kline[1];
      const highPrice = kline[2];
      const lowPrice = kline[3];
      const closePrice = kline[4];
      const tradeVolume = kline[5];

      // Verificación de tipos y valores válidos
      if (
        typeof timestampMs !== 'number' ||
        typeof closePrice !== 'number' ||
        typeof tradeVolume !== 'number'
      ) {
        console.warn(`[API Klines] Datos numéricos faltantes o inválidos en kline en ${networkType}: ${kline}`);
        return null;
      }

      return {
        timestamp: Math.floor(timestampMs / 1000),
        price: closePrice,
        volume: tradeVolume,
        // Si deseas agregar más:
        // open: typeof openPrice === 'number' ? openPrice : undefined,
        // high: typeof highPrice === 'number' ? highPrice : undefined,
        // low: typeof lowPrice === 'number' ? lowPrice : undefined,
      };
    }).filter((kline): kline is MarketPriceDataPoint => kline !== null);


    if (transformedKlines.length === 0) {
      console.warn(`[API Klines] Todos los klines filtrados después de la transformación en ${networkType}.`);
      return NextResponse.json(
        { success: false, message: `Los datos de klines recibidos para ${ccxtSymbol} (${timeframe}) en ${networkType} no pudieron ser procesados.`, klines: [] }, // Indicar success: false si no hay datos válidos después de filtrar
        { status: 500 } // Error interno si no se puede procesar nada
      );
    }

    console.log(`[API Klines] Klines transformados y listos para enviar desde ${networkType}: ${transformedKlines.length} puntos.`);

    return NextResponse.json({
      success: true, // Indicar éxito si se devuelven datos transformados
      message: `Klines para ${symbol} (${timeframe}) obtenidos con éxito de ${networkType}.`,
      klines: transformedKlines,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=120', // Cache por 60 segundos, revalidar en 120
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
      // --- INICIO SECCIÓN MODIFICADA: Declarar 'details' al inicio del catch ---
      let details: string | undefined = undefined; // Declarar details aquí
      // --- FIN SECCIÓN MODIFICADA: Declarar 'details' al inicio del catch ---

      let errorMessage = `Error desconocido al obtener Klines de Binance ${networkType}.`;
      let statusCode = 500;
      let binanceErrorCode = undefined;

      if (error instanceof ccxt.NetworkError) {
        errorMessage = `Error de red o conexión con Binance ${networkType}: ${error.message}`;
        details = error.message; // Asignar valor en cada rama específica de error
        statusCode = 503; // Service Unavailable
      } else if (error instanceof ccxt.ExchangeError) {
        errorMessage = `Error de la API de Binance ${networkType}: ${error.message}`;
        details = error.message; // Asignar valor
        statusCode = 502; // Bad Gateway (error del upstream, Binance)
        // Intentar extraer código de error si está en el mensaje
        if (error.message.includes('code=')) {
            const codeMatch = error.message.match(/code=(-?\d+)/);
            if (codeMatch && codeMatch[1]) {
                binanceErrorCode = parseInt(codeMatch[1], 10);
                console.warn(`[API Klines] Código de error de Binance extraído: ${binanceErrorCode}`);
            }
        }
      } else if (error instanceof Error) {
        errorMessage = `Error interno del servidor al procesar klines para ${symbol || 'símbolo desconocido'} en ${networkType}: ${error.message}`;
        details = error.message; // Asignar valor
        statusCode = 500;
      } else {
          // Manejar otros tipos de error no capturados específicamente
          console.error(`[API Klines] Error inesperado en ${networkType} para ${symbol || 'símbolo desconocido'}:`, error);
          errorMessage = `Ocurrió un error inesperado al obtener klines para ${symbol || 'símbolo desconocido'} en ${networkType}.`;
          statusCode = 500;
          // Asegurar que details se asigna aquí también
          details = error.message || JSON.stringify(error);
      }

      console.error(`[API Klines] Error al procesar solicitud: ${errorMessage}`, error);

      // La variable 'details' ahora está declarada en el ámbito del catch
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          details: details, // Usar la variable declarada
          binanceErrorCode: binanceErrorCode,
        },
        { status: statusCode }
      );
    }
      
}
