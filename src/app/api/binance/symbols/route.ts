// src/app/api/binance/symbols/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Interfaz para la estructura de la solicitud (request body)
interface SymbolsRequest {
  isTestnet?: boolean; // Opcional: Bandera para indicar si usar la red de prueba
  // Podrías añadir parámetros para controlar los filtros si fuera necesario
  // quoteAsset?: string; // Ej: 'USDT', 'BTC'
  // status?: string; // Ej: 'TRADING'
}

// --- Configuración de CCXT para Mainnet y Testnet ---
// Asegúrate de tener las claves API configuradas si los endpoints de info requieren autenticación
// Aunque fetchMarkets no suele requerirlas, es buena práctica tenerlas disponibles.
// BINANCE_API_KEY, BINANCE_SECRET_KEY (para Mainnet)
// BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY (para Testnet)

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  // No necesitamos defaultType para fetchMarkets generalmente
});

const exchangeTestnet = new ccxt.binance({
    apiKey: process.env.BINANCE_TESTNET_API_KEY,
    secret: process.env.BINANCE_TESTNET_SECRET_KEY,
    urls: {
        // --- URLs de la API de Testnet ---
        // Asegúrate de usar las URLs correctas para la Testnet de Binance que estés utilizando (Spot o Futures).
        // Estas deben coincidir con la red de la que quieras obtener los símbolos.
        // Ejemplo para Spot Testnet (APIs públicas):
         'api': {
           'public': 'https://testnet.binance.vision/api/',
           // 'private': 'https://testnet.binance.vision/api/', // fetchMarkets no suele requerir private
         },
        // Ejemplo para Futures USD-M Testnet (APIs públicas):
        // 'api': {
        //   'public': 'https://testnet.binancefuture.com/fapi/v1',
        //   // 'private': 'https://testnet.binancefuture.com/fapi/v1',
        // },
    },
});
// --- Fin Configuración CCXT ---


// Usaremos POST para poder enviar parámetros como isTestnet y futuros filtros
export async function POST(req: Request) {
  let isTestnet = false; // Valor por defecto

  console.log(`[API/Binance/Symbols] Solicitud POST recibida.`);

  try {
      const requestBody: SymbolsRequest = await req.json();
      // Desestructurar y asignar valor por defecto a isTestnet si es undefined
      ({ isTestnet = false } = requestBody);
      // También podrías obtener filtros aquí si los añades a la interfaz SymbolsRequest

      console.log(`[API/Binance/Symbols] Parámetros de solicitud parseados: Testnet=${isTestnet}`);

  } catch (jsonError: any) {
      console.error("[API/Binance/Symbols] Error al parsear el cuerpo de la solicitud JSON:", jsonError);
      // Opcional: Permitir GET sin body si es necesario, pero POST con body es más consistente con otros endpoints
      return NextResponse.json({
        success: false,
        message: "Error al procesar la solicitud. Formato JSON inválido."
      }, { status: 400 });
  }


  const exchangeToUse = isTestnet ? exchangeTestnet : exchangeMainnet;
  const networkType = isTestnet ? 'Testnet' : 'Mainnet';

  console.log(`[API/Binance/Symbols] Usando configuración para la red: ${networkType}`);

  // --- Obtener Lista de Mercados usando CCXT ---
  try {
    console.log(`[API/Binance/Symbols] Solicitando lista de mercados a CCXT en ${networkType}...`);

    // ccxt.fetchMarkets() obtiene la lista de todos los mercados y sus reglas
    // --- INICIO SECCIÓN MODIFICADA: Aserción de tipo a any[] ---
    // Asertamos el resultado como any[] para evitar errores de tipo con propiedades anidadas
    const markets = await exchangeToUse.fetchMarkets() as any[];
    // --- FIN SECCIÓN MODIFICADA: Aserción de tipo a any[] ---


    console.log(`[API/Binance/Symbols] Lista de mercados obtenida de CCXT en ${networkType}. Cantidad: ${markets ? markets.length : 0}`);
    // console.log(JSON.stringify(markets, null, 2)); // Log detallado si es necesario para depurar

    // --- INICIO SECCIÓN MODIFICADA: Aplicar Filtros y Formatear Resultados con aserción a any ---
    const filteredAndFormattedSymbols = markets
        // Asertamos cada 'market' a any dentro del map y filter para acceder a sus propiedades
        .filter((market: any) =>
             // Usar encadenamiento opcional y verificaciones al acceder a propiedades anidadas
            market?.active === true && // Solo mercados activos (CCXT mapea el estado 'TRADING')
            market?.quote === 'USDT' // Mantener filtro por USDT por ahora
            // Puedes añadir más filtros aquí si los necesitas
        )
        .map((market: any) => {
             // Usar encadenamiento opcional al acceder a propiedades que pueden no existir
             const minNotional = market?.limits?.cost?.min; // Monto mínimo en moneda cotizada para una orden
             const minQty = market?.limits?.amount?.min; // Cantidad mínima del activo base
             const amountPrecision = market?.precision?.amount; // Precisión para la cantidad
             const pricePrecision = market?.precision?.price; // Precisión para el precio
             // CORRECCIÓN: La precisión de la moneda cotizada suele ser la misma que la de precio, o a veces una propiedad separada pero no 'quote' directamente bajo precision. Usaremos pricePrecision para quotePrecision como una aproximación, o puedes ajustar si tu tipo Market tiene 'quotePrecision'.
             const quotePrecision = market?.precision?.price; // Usamos pricePrecision para quotePrecision, o ajusta si tu Market lo tiene diferente


             return {
                id: market?.id, // El símbolo completo (ej. BTC/USDT en CCXT)
                symbol: market?.symbol, // El símbolo estandarizado (ej. BTC/USDT)
                name: `${market?.base}/${market?.quote}`, // Nombre amigable (ej. BTC/USDT) - CORRECCIÓN FORMATO
                baseAsset: market?.base, // Moneda base (ej. BTC)
                quoteAsset: market?.quote, // Moneda cotizada (ej. USDT)
                latestPrice: null, // Se actualizará en el frontend con el ticker
                // Añadir reglas de trading importantes que puedan necesitarse en el frontend o hooks
                minNotional: minNotional,
                minQty: minQty,
                amountPrecision: amountPrecision,
                pricePrecision: pricePrecision,
                quotePrecision: quotePrecision, // Usamos la propiedad calculada/obtenida
                // Puedes añadir más reglas o propiedades de 'market' si son relevantes
            };
        });

    // Eliminar posibles resultados 'undefined' o 'null' si el mapeo falló para algún elemento
    const cleanFilteredAndFormattedSymbols = filteredAndFormattedSymbols.filter(symbol => symbol !== undefined && symbol !== null);

    // --- FIN SECCIÓN MODIFICADA: Aplicar Filtros y Formatear Resultados con aserción a any ---


    console.log(`[API/Binance/Symbols] ${cleanFilteredAndFormattedSymbols.length} símbolos filtrados y formateados.`);
    // console.log(JSON.stringify(cleanFilteredAndFormattedSymbols, null, 2)); // Log de los símbolos formateados si es necesario

    // --- Respuesta Exitosa ---
    return NextResponse.json({
      success: true,
      message: `Lista de símbolos obtenida con éxito de Binance ${networkType}.`,
      symbols: cleanFilteredAndFormattedSymbols, // Devolvemos la lista filtrada y formateada limpia
    });

  } catch (error: any) {
    console.error(`[API/Binance/Symbols] Error al obtener lista de mercados con CCXT en ${networkType}:`, error);

    // --- Manejo de Errores Específicos de Binance/CCXT ---
    let userMessage = `Error al obtener la lista de símbolos de Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500; // Por defecto, un error interno del servidor
    let binanceErrorCode = undefined;

    // ccxt encapsula errores de la API de Binance
    if (error instanceof ccxt.NetworkError) {
        console.error(`[API/Binance/Symbols] Error de Red al intentar conectar con Binance ${networkType}.`);
        userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
        details = error.message;
        statusCode = 503; // Servicio no disponible temporalmente

    } else if (error instanceof ccxt.AuthenticationError) {
         // Aunque fetchMarkets no suele requerir autenticación, es bueno manejar este caso
         console.error(`[API/Binance/Symbols] Error de Autenticación en ${networkType}.`);
         userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
         details = error.message;
         statusCode = 401; // No autorizado

    } else if (error instanceof ccxt.ExchangeError) {
         console.error(`[API/Binance/Symbols] Error genérico del Exchange en ${networkType}.`);
         userMessage = "Ocurrió un error en el exchange de Binance al obtener la lista de símbolos.";
         details = error.message;
         // Intentar obtener código de error específico de Binance si está disponible
         if (error.message.includes('code=')) {
              const codeMatch = error.message.match(/code=(-?\d+)/);
              if (codeMatch && codeMatch[1]) {
                  binanceErrorCode = parseInt(codeMatch[1], 10);
                  console.warn(`[API/Binance/Symbols] Código de error de Binance extraído: ${binanceErrorCode}`);
              }
          }
         // Puedes asignar un statusCode diferente si hay errores de Exchange específicos conocidos

    } else {
        // Otros tipos de error no capturados específicamente
        console.error(`[API/Binance/Symbols] Error inesperado en ${networkType}:`, error);
        userMessage = "Ocurrió un error inesperado al obtener la lista de símbolos.";
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
