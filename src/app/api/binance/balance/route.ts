// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Definir una interfaz para la estructura de la solicitud (request body)
interface BalanceRequest {
  isTestnet?: boolean; // Nuevo: Bandera para indicar si usar la red de prueba
  // Podrías añadir parámetros para filtrar activos si fuera necesario
  // assets?: string[]; // Ejemplo: ['BTC', 'USDT']
}

// --- Configuración de CCXT para Mainnet y Testnet ---
// Asegúrate de tener las claves API configuradas en tus variables de entorno (.env.local)
// BINANCE_API_KEY, BINANCE_SECRET_KEY (para Mainnet)
// BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY (para Testnet)

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    // Configura el tipo por defecto (spot o future) si es necesario para Mainnet
    'defaultType': 'spot', // Por defecto para balances de Spot
    // 'defaultType': 'future', // Si necesitas balances de Futuros
  },
  // Por defecto usa la API de producción (Mainnet)
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    options: {
        // Configura el tipo por defecto (spot o future) para Testnet
        'defaultType': 'spot', // Por defecto para balances de Spot Testnet
        // 'defaultType': 'future', // Si necesitas balances de Futuros Testnet
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
});
// --- Fin Configuración CCXT ---


// Usaremos POST para mayor consistencia y para poder enviar parámetros como isTestnet
// Usaremos POST para mayor consistencia y para poder enviar parámetros como isTestnet
export async function POST(req: Request) {
  let isTestnet = false; // Valor por defecto

  try {
      const requestBody: BalanceRequest = await req.json();
      // Desestructurar y asignar valor por defecto a isTestnet si es undefined
      ({ isTestnet = false } = requestBody);
      console.log(`[API/Binance/Balance] Recibida solicitud de balances en ${isTestnet ? 'Testnet' : 'Mainnet'}`);

  } catch (jsonError: any) {
      // Modificación: Eliminar la lógica para manejar solicitudes GET aquí.
      // Si hay un error al parsear el JSON, asumimos que la solicitud POST no tiene un cuerpo JSON válido.
      console.error("[API/Binance/Balance] Error al parsear el cuerpo de la solicitud POST:", jsonError);
      return NextResponse.json({
          success: false,
          message: "Error al procesar la solicitud POST. Formato JSON inválido."
      }, { status: 400 });
      // Fin de la modificación
  }

  // Modificación: Eliminar la lógica para verificar parámetros de query para solicitudes GET.
  // Dado que solo manejaremos POST, no necesitamos buscar isTestnet en los query params.
  /*
   if (req.method === 'GET' && req.url) {
       const { searchParams } = new URL(req.url);
       // Permitir isTestnet como parámetro de query para solicitudes GET
       if (searchParams.has('isTestnet') && searchParams.get('isTestnet')?.toLowerCase() === 'true') {
           isTestnet = true;
           console.log("[API/Binance/Balance] isTestnet=true detectado en parámetros de query (GET).");
       }
   }
   */
  // Fin de la modificación


  const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
  const networkType = isTestnet ? 'Testnet' : 'Mainnet';

  // ...resto del código...


  // --- Validación de Credenciales ---
  if (exchangeToUse.apiKey === undefined || exchangeToUse.secret === undefined) {
    console.error(`[API/Binance/Balance] Error: Las credenciales de ${networkType} no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance ${networkType} no están configuradas en las variables de entorno (.env.local).`
    }, { status: 500 });
  }
    console.log(`[API/Binance/Balance] Credenciales de ${networkType} cargadas correctamente.`);


  // --- Obtener Balances usando CCXT ---
  try {
    console.log(`[API/Binance/Balance] Solicitando balances a CCXT en ${networkType}...`);

    // ccxt.fetchBalance() obtiene los balances de la cuenta Spot por defecto
    // Si necesitas balances de Futuros, configura 'defaultType' en la instancia de exchange
    const accountBalance = await exchangeToUse.fetchBalance();

    console.log(`[API/Binance/Balance] Balances obtenidos de CCXT en ${networkType}.`);
    // console.log(JSON.stringify(accountBalance, null, 2)); // Log detallado si es necesario para depurar

    // ccxt.fetchBalance() devuelve un objeto con la estructura { 'asset': { free: ..., used: ..., total: ... }, ... }
    // accountBalance.total: { 'USDT': 1000, 'BTC': 0.5, ... }
    // accountBalance.free: { 'USDT': 900, 'BTC': 0.5, ... } // Saldo disponible
    // accountBalance.used: { 'USDT': 100, 'BTC': 0, ... } // Saldo en órdenes abiertas
    // --- LOGGING ADICIONAL PARA DEPURACIÓN ---
    console.log(`[API/Binance/Balance] Respuesta cruda de fetchBalance:`, accountBalance); // Log de la respuesta antes de formatear
    // --- FIN LOGGING ADICIONAL ---

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};

    // Iterar sobre todos los activos reportados por ccxt
    // CORRECCIÓN APLICADA: Usar aserción a unknown primero para permitir indexación por strings de forma segura
    if (accountBalance && accountBalance.total) {
        // Aserción a unknown primero, luego a Record<string, number>
        const totalBalances = accountBalance.total as unknown as Record<string, number>;
        const freeBalances = accountBalance.free as unknown as Record<string, number>;
        const usedBalances = accountBalance.used as unknown as Record<string, number>;


        for (const asset in totalBalances) { // Iterar sobre totalBalances que ahora tiene la firma de índice
            // Usamos Object.prototype.hasOwnProperty.call para una verificación segura de la propiedad
            if (Object.prototype.hasOwnProperty.call(totalBalances, asset)) {
                 // Ahora TypeScript permite acceder usando 'asset' porque totalBalances tiene la firma de índice
                 const total = totalBalances[asset];
                 const free = freeBalances[asset];
                 const used = usedBalances[asset];

                 // Opcional: Filtrar activos con saldo insignificante si deseas una respuesta más limpia
                 // Incluimos activos con saldo total mayor a 0
                 if (total > 0) { // Puedes ajustar el umbral (ej: 0.00000001) si es necesario
                     balancesFormatted[asset] = {
                         available: free,
                         onOrder: used, // ccxt uses 'used' for funds tied in orders
                         total: total,
                     };
                 }
            }
        }
    }


    console.log(`[API/Binance/Balance] ${Object.keys(balancesFormatted).length} activos con saldo > 0 formateados.`);
    // console.log(JSON.stringify(balancesFormatted, null, 2)); // Log de balances formateados

    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Balances de cuenta obtenidos con éxito de Binance ${networkType}.`,
      balances: balancesFormatted, // Devolvemos todos los balances > 0
      timestamp: accountBalance.timestamp, // Timestamp de la respuesta de Binance
      datetime: accountBalance.datetime, // Fecha y hora legible
    });

  } catch (error: any) {
    console.error(`[API/Binance/Balance] Error al obtener balances con CCXT en ${networkType}:`, error);

    // --- Manejo de Errores Específicos de Binance/CCXT ---
    let userMessage = `Error al obtener los balances de la cuenta en Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;

    // ccxt encapsula errores de la API de Binance
    if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/Balance] Error de Red al intentar conectar con Binance ${networkType}.`);
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente

    } else if (error instanceof ccxt.AuthenticationError) {
         console.error(`[API/Binance/Balance] Error de Autenticación en ${networkType}.`);
         userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
         details = error.message;
         statusCode = 401; // No autorizado

    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/Balance] Error genérico del Exchange en ${networkType}.`);
         userMessage = "Ocurrió un error en el exchange de Binance al obtener balances.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/Balance] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos

    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/Balance] Error inesperado en ${networkType}:`, error);
        userMessage = "Ocurrió un error inesperado al obtener los balances.";
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
