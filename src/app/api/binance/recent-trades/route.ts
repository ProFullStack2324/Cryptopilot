// src/app/api/binance/recent-trades/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Configuración de CCXT para Mainnet y Testnet
// fetchTrades generalmente es un endpoint público y no requiere API keys,
// pero las incluimos por consistencia.
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  // fetchTrades para Spot Mainnet no suele requerir defaultType, pero puede ser útil para otros métodos
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    urls: {
        // URLs de la API de Testnet para fetchTrades
        // Asegúrate de usar las URLs correctas para la Testnet de Binance que estés utilizando (Spot o Futures).
        // Ejemplo para Spot Testnet:
         api: {
           public: 'https://testnet.binance.vision/api/',
           private: 'https://testnet.binance.vision/api/', // A veces se requiere la URL privada incluso para métodos "públicos" como fetchTrades
         },
        // Ejemplo para Futures USD-M Testnet:
        // api: {
        //   public: 'https://testnet.binancefuture.com/fapi/v1',
        //   private: 'https://testnet.binancefuture.com/fapi/v1',
        // },
    },
});

// Usaremos GET para este endpoint ya que normalmente solo se consulta información pública
export async function GET(request: Request) {
  console.log('[API/Binance/RecentTrades] Solicitud GET recibida.');

  let symbol: string | null = null;
  let isTestnet = false; // Valor por defecto false
  let limitParam: string | null = null;
  let limit: number | undefined;
  let sinceParam: string | null = null;
  let since: number | undefined;


  try {
    const { searchParams } = new URL(request.url);
    symbol = searchParams.get('symbol'); // Obtener el símbolo del query param

    // --- Lógica de Depuración: Logear todos los query params ---
    console.log('[API/Binance/RecentTrades] Query Params recibidos:');
    searchParams.forEach((value, key) => {
        console.log(`[API/Binance/RecentTrades]   ${key}: ${value}`);
    });
    // --- Fin Lógica de Depuración ---


    // Determinación de isTestnet
    if (searchParams.has('isTestnet')) {
        const isTestnetQueryParam = searchParams.get('isTestnet')?.toLowerCase();
        if (isTestnetQueryParam === 'true') {
            isTestnet = true;
        } else if (isTestnetQueryParam === 'false') {
            isTestnet = false;
        }
         console.log(`[API/Binance/RecentTrades] Parámetro isTestnet detectado: ${isTestnet}.`);
    } else {
         console.log(`[API/Binance/RecentTrades] Parámetro isTestnet NO detectado. Usando valor por defecto: ${isTestnet}.`);
    }

    // Parsear limitParam
    limitParam = searchParams.get('limit');
    if (limitParam) {
        const parsedLimit = parseInt(limitParam);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = parsedLimit;
            console.log(`[API/Binance/RecentTrades] Límite parseado: ${limit}.`);
        } else {
             console.warn(`[API/Binance/RecentTrades] Advertencia: Límite inválido "${limitParam}". Usando defecto.`);
        }
    } else {
         console.log('[API/Binance/RecentTrades] Límite NO detectado. Usando defecto.');
    }

    // Parsear sinceParam (si se busca trades desde un momento específico)
    sinceParam = searchParams.get('since');
    if (sinceParam) {
        const parsedSince = parseInt(sinceParam);
         if (!isNaN(parsedSince) && parsedSince > 0) {
            since = parsedSince;
            console.log(`[API/Binance/RecentTrades] Since parseado (timestamp): ${since}.`);
        } else {
             console.warn(`[API/Binance/RecentTrades] Advertencia: Since inválido "${sinceParam}". Usando defecto.`);
        }
    } else {
         console.log('[API/Binance/RecentTrades] Since NO detectado. Usando defecto (trades más recientes).');
    }


    const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
    const networkType = isTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[API/Binance/RecentTrades] Usando configuración para la red: ${networkType}.`);


    if (!symbol) {
      console.warn(`[API/Binance/RecentTrades] Error 400 en ${networkType}: Parámetro \"symbol\" es requerido.`);
      return NextResponse.json(
        { success: false, message: `Parámetro \"symbol\" es requerido para obtener trades recientes en ${networkType}.` },
        { status: 400 }
      );
    }

     // Validar Credenciales (fetchTrades puede no requerirlas, pero por si acaso)
    // Aunque fetchTrades a menudo es público, si tu configuración requiere API keys, valida:
    if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
      console.error(`[API/Binance/RecentTrades] Error: Las credenciales de ${networkType} no están configuradas.`);
      return NextResponse.json({
        success: false,
        message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`,
        details: `Endpoint: /api/binance/recent-trades, Red solicitada: ${networkType}`
      }, { status: 500 });
    }
     console.log(`[API/Binance/RecentTrades] Credenciales de ${networkType} cargadas correctamente.`);


    // Normalizar el símbolo para ccxt (ej: BTCUSDT -> BTC/USDT)
    const ccxtSymbol = symbol.includes('/') ? symbol.toUpperCase() : `${symbol.toUpperCase().replace('USDT', '')}/USDT`;
     console.log(`[API/Binance/RecentTrades] Símbolo CCXT normalizado: ${ccxtSymbol}.`);


    // --- Obtener Recent Trades usando CCXT ---
    console.log(`[API/Binance/RecentTrades] Solicitando trades recientes a CCXT en ${networkType} para símbolo: ${ccxtSymbol}...`);
    console.log(`[API/Binance/RecentTrades] CCXT fetchTrades params: symbol=${ccxtSymbol}, since=${since || 'undefined'}, limit=${limit || 'undefined'}`);

    const trades = await exchangeToUse.fetchTrades(
      ccxtSymbol,
      since, // since: Timestamp opcional (milisegundos)
      limit  // limit: Límite de trades a obtener
    );

    console.log(`[API/Binance/RecentTrades] Trades recientes obtenidos de CCXT en ${networkType}. Cantidad: ${trades ? trades.length : 0}.`);
    // --- Lógica de Depuración: Loguear los primeros trades obtenidos (solo unos pocos para no saturar) ---
    if (trades && trades.length > 0) {
        console.log('[API/Binance/RecentTrades] Primeros 5 trades obtenidos:', trades.slice(0, 5));
    }
    // --- Fin Lógica de Depuración ---


    if (!trades || trades.length === 0) {
      console.warn(`[API/Binance/RecentTrades] No se recibieron trades recientes para ${ccxtSymbol} en ${networkType}.`);
      return NextResponse.json(
        { success: true, message: `No se encontraron trades recientes para ${ccxtSymbol} en ${networkType}.`, trades: [] }, // Indicar success: true si es solo falta de datos
        { status: 200 }
      );
    }

    // --- Formateo de Resultados (si es necesario, ccxt ya devuelve un formato estandarizado) ---
    // ccxt.fetchTrades() devuelve un array de objetos Trade (con una estructura estándar de CCXT)
    // La estructura ya es bastante amigable para el frontend. Podemos devolverla directamente o mapear si necesitas un formato diferente.
    // Asumimos que la estructura estándar de ccxt es suficiente por ahora.

     console.log(`[API/Binance/RecentTrades] ${trades.length} trades listos para enviar.`);


    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Trades recientes para ${symbol} obtenidos con éxito de ${networkType}.`,
      trades: trades, // Devolvemos el array de trades directamente
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // No cachear trades recientes (son en tiempo real)
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
      }
    });

  } catch (error: any) {
    console.error(`[API/Binance/RecentTrades] Error al obtener trades recientes para ${symbol || 'símbolo desconocido'} en ${isTestnet ? 'Testnet' : 'Mainnet'}:`, error);

    // --- Manejo de Errores Específicos de Binance/CCXT ---
    let userMessage = `Error al obtener los trades recientes de Binance ${isTestnet ? 'Testnet' : 'Mainnet'}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;


    if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/RecentTrades] Error de Red al intentar conectar con Binance ${isTestnet ? 'Testnet' : 'Mainnet'}.`);
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente


    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/RecentTrades] Error genérico del Exchange en ${isTestnet ? 'Testnet' : 'Mainnet'}.`);
         userMessage = "Ocurrió un error en el exchange de Binance al obtener los trades recientes.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/RecentTrades] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos


    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/RecentTrades] Error inesperado en ${isTestnet ? 'Testnet' : 'Mainnet'} para ${symbol || 'símbolo desconocido'}:`, error);
        userMessage = `Ocurrió un error inesperado al obtener trades recientes para ${symbol || 'símbolo desconocido'} en ${isTestnet ? 'Testnet' : 'Mainnet'}.`;
        details = error.message || JSON.stringify(error);
        statusCode = 500;
    }


    // --- Respuesta de Error ---
    return NextResponse.json(
      {
        success: false,
        message: userMessage, // Mensaje amigable para el usuario
        details: details,     // Detalles técnicos del error (para depuración)
        binanceErrorCode: binanceErrorCode, // Código de error específico de Binance si se pudo extraer
        // Puedes añadir otros campos de error si son útiles
      },
      { status: statusCode }
    );


  }
}
