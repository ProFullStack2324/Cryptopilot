
// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Definir una interfaz para la estructura de la solicitud (request body)
interface BalanceRequest {
  isTestnet?: boolean;
}

// --- Configuración de CCXT para Mainnet y Testnet ---
// Asegúrate de tener las claves API configuradas en tus variables de entorno (.env.local)
// BINANCE_API_KEY, BINANCE_SECRET_KEY (para Mainnet)
// BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY (para Testnet)

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    // 'defaultType': 'spot', // O 'future', según lo que necesites por defecto para Mainnet
  },
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    options: {
        // 'defaultType': 'spot', // O 'future', para Testnet
    },
    urls: {
        // URLs para Spot Testnet (ejemplo, verifica las URLs oficiales de Binance Testnet)
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
});
// --- Fin Configuración CCXT ---

// Usaremos POST para mayor consistencia y para poder enviar parámetros como isTestnet
export async function POST(req: Request) {
  let isTestnetUserValue: boolean | undefined = undefined;

  try {
    const requestBody: BalanceRequest = await req.json();
    isTestnetUserValue = requestBody.isTestnet;
    console.log(`[API/Binance/Balance] Solicitud POST recibida. Cuerpo:`, requestBody);
  } catch (jsonError: any) {
    // Si hay un error al parsear el JSON (ej. GET request sin body),
    // continuamos con isTestnetUserValue como undefined.
    // Los GET requests se manejarán con isTestnet=false por defecto si no se especifica el query param.
    console.warn("[API/Binance/Balance] No se pudo parsear el cuerpo JSON (puede ser una solicitud GET o cuerpo vacío).", jsonError.message);
  }

  // Determinar isTestnet:
  // 1. Prioridad al valor del body (si es POST y se parseó).
  // 2. Si no, verificar query params (para GET).
  // 3. Default a false.
  let isTestnet: boolean = false;
  if (typeof isTestnetUserValue === 'boolean') {
    isTestnet = isTestnetUserValue;
  } else if (req.url) {
    const { searchParams } = new URL(req.url);
    if (searchParams.has('isTestnet') && searchParams.get('isTestnet')?.toLowerCase() === 'true') {
      isTestnet = true;
      console.log("[API/Binance/Balance] isTestnet=true detectado en parámetros de query (GET).");
    }
  }

  const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
  const networkType = isTestnet ? 'Testnet' : 'Mainnet';

  console.log(`[API/Binance/Balance] Usando configuración para ${networkType}.`);

  // --- Validación de Credenciales ---
  if (!exchangeToUse.apiKey || !exchangeToUse.secret) {
    console.error(`[API/Binance/Balance] Error: Las credenciales de ${networkType} no están configuradas en .env.local.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno. Revisa tu archivo .env.local y asegúrate de que las variables ${isTestnet ? 'BINANCE_TESTNET_API_KEY/BINANCE_TESTNET_SECRET_KEY' : 'BINANCE_API_KEY/BINANCE_SECRET_KEY'} estén definidas.`
    }, { status: 500 });
  }
  console.log(`[API/Binance/Balance] Credenciales de ${networkType} parecen estar cargadas (verificación básica).`);


  // --- Obtener Balances usando CCXT ---
  try {
    console.log(`[API/Binance/Balance] Solicitando balances a CCXT en ${networkType}...`);
    const accountBalance = await exchangeToUse.fetchBalance();
    console.log(`[API/Binance/Balance] Balances obtenidos de CCXT en ${networkType}.`);

    // ccxt.fetchBalance() devuelve una estructura como:
    // {
    //   info: { ...raw response... },
    //   BTC: { free: 0.0, used: 0.0, total: 0.0 },
    //   USDT: { free: 100.0, used: 10.0, total: 110.0 },
    //   ...
    //   free: { BTC: 0.0, USDT: 100.0, ... },
    //   used: { BTC: 0.0, USDT: 10.0, ... },
    //   total: { BTC: 0.0, USDT: 110.0, ... }
    // }
    // Queremos filtrar y formatear los balances individuales de cada activo.

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};

    if (accountBalance.total) { // 'total' contiene un objeto con los totales por activo
      for (const asset in accountBalance.total) {
        if (Object.prototype.hasOwnProperty.call(accountBalance.total, asset)) {
          const totalAmount = accountBalance.total[asset];
          if (totalAmount !== undefined && totalAmount > 0) { // Incluir solo activos con saldo total > 0
            balancesFormatted[asset] = {
              available: accountBalance.free[asset] || 0,
              onOrder: accountBalance.used[asset] || 0,
              total: totalAmount,
            };
          }
        }
      }
    }

    console.log(`[API/Binance/Balance] ${Object.keys(balancesFormatted).length} activos con saldo > 0 formateados.`);

    return NextResponse.json({
      success: true,
      message: `Balances de cuenta obtenidos con éxito de Binance ${networkType}.`,
      balances: balancesFormatted,
      timestamp: accountBalance.timestamp || Date.now(),
      datetime: accountBalance.datetime || new Date().toISOString(),
    });

  } catch (error: any) {
    console.error(`[API/Binance/Balance] Error al obtener balances con CCXT en ${networkType}:`, error);

    let userMessage = `Error al obtener los balances de la cuenta en Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;
    let binanceErrorCode: number | undefined = undefined;

    if (error instanceof ccxt.AuthenticationError) {
         console.error(`[API/Binance/Balance] Error de Autenticación en ${networkType} (CCXT). Código de error de Binance: ${error.message.match(/code=(-?\d+)/)?.[1]}`);
         userMessage = `Error de autenticación con la API de Binance ${networkType}. Verifica tus claves API y sus permisos. Código de Binance: ${error.message.match(/code=(-?\d+)/)?.[1] || 'No disponible'}`;
         details = error.message;
         statusCode = 401; // No autorizado
         const codeMatch = error.message.match(/code=(-?\d+)/);
         if (codeMatch && codeMatch[1]) {
             binanceErrorCode = parseInt(codeMatch[1], 10);
         }
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = `Error de conexión con la API de Binance ${networkType}. Intenta de nuevo más tarde.`;
        statusCode = 503; // Servicio no disponible
    } else if (error instanceof ccxt.ExchangeError) {
         userMessage = `Ocurrió un error en el exchange de Binance (${networkType}) al obtener balances.`;
         const codeMatch = error.message.match(/code=(-?\d+)/);
         if (codeMatch && codeMatch[1]) {
             binanceErrorCode = parseInt(codeMatch[1], 10);
             userMessage += ` Código de Binance: ${binanceErrorCode}.`;
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

// Permitir solicitudes GET también, aunque el cuerpo no se usará para isTestnet (se usará query param)
export async function GET(req: Request) {
  // Para GET, isTestnet se determina únicamente por el query param dentro de la lógica de POST.
  // Reenviamos la solicitud a POST para unificar la lógica.
  // Esto es un patrón para manejar GET y POST con la misma lógica si la función POST ya puede manejar
  // la ausencia de un body (lo cual hemos hecho al tratar jsonError).
  
  // Creamos un "Request" artificial que simula no tener body para que la lógica de POST use los query params.
  const pseudoPostRequest = new Request(req.url, {
    method: 'POST', // Para que la lógica de POST se active
    headers: req.headers,
    // No body, para que la lógica de POST en el catch(jsonError) proceda a revisar query params.
  });
  return POST(pseudoPostRequest);
}

    