// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
// Asegúrate de que esta librería esté instalada: npm install node-binance-api
import Binance from 'node-binance-api';

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
  console.error("ERROR: BINANCE_API_KEY o BINANCE_SECRET_KEY no están definidos en .env.local");
  // Opcional: podrías lanzar un error aquí para detener el servidor
  // throw new Error("Binance API keys are not configured.");
}

const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: SECRET_KEY,
  // Si estás trabajando con una cuenta de prueba (testnet), deberías configurar la URL de la API aquí:
  // url: 'https://testnet.binance.vision/api/', // Para Binance Testnet Spot
  // Para futuros:
  // defaultType: 'futures', // Si trabajas con futuros
  // Para obtener los balances de spot, por defecto no necesitas 'defaultType'
});

// 1. Define una interfaz para la estructura de un activo individual
interface AssetBalanceDetail {
  available: string;
  onOrder: string;
  [key: string]: any; // Permite propiedades adicionales sin errores de tipo
}

// 2. Define una interfaz para el objeto completo que devuelve binance.balance()
interface BinanceAccountInfo {
  [assetSymbol: string]: AssetBalanceDetail;
}

/**
 * Manejador de la petición GET para obtener los balances de la cuenta de Binance.
 * Acceso: http://localhost:9002/api/binance/balance
 */
export async function GET(request: Request) {
  try {
    console.log("[API/Binance/Balance] Solicitando balances a Binance...");

    // Obtenemos los balances de la cuenta
    const accountInfo: BinanceAccountInfo = await binance.balance();

    console.log("[API/Binance/Balance] Balances obtenidos de node-binance-api (RAW):");
    console.log(JSON.stringify(accountInfo, null, 2)); // Log de la respuesta cruda

    // Definimos los activos específicos que nos interesan
    const targetAssets = ['USDT', 'LTC', 'FDUSD', 'APE'];
    
    const specificBalances: Record<string, { available: string; onOrder: string }> = {};

    // Iteramos sobre los activos deseados y los buscamos en la respuesta de Binance
    for (const asset of targetAssets) {
        if (accountInfo[asset]) {
            const availableStr = accountInfo[asset].available;
            const onOrderStr = accountInfo[asset].onOrder;

            const available = parseFloat(availableStr);
            const onOrder = parseFloat(onOrderStr);

            // Incluimos el activo si tiene un saldo mayor que cero o está en una orden
            // Puedes ajustar el umbral de '0.000000001' si es necesario
            if (available > 0.000000001 || onOrder > 0.000000001) {
                specificBalances[asset] = {
                    available: available.toFixed(8),
                    onOrder: onOrder.toFixed(8),
                };
            } else {
                // Si el activo existe pero tiene saldo cero, también podemos incluirlo
                // o decidir no incluirlo. Para este caso, lo incluiremos para mostrarlo
                // explícitamente con 0 si es que existe en la respuesta de Binance.
                specificBalances[asset] = {
                    available: available.toFixed(8),
                    onOrder: onOrder.toFixed(8),
                };
            }
        } else {
            // Si el activo no está presente en la respuesta de Binance (lo que significa 0)
            specificBalances[asset] = {
                available: "0.00000000",
                onOrder: "0.00000000",
            };
        }
    }

    console.log("[API/Binance/Balance] Balances específicos de los 4 activos solicitados:");
    console.log(JSON.stringify(specificBalances, null, 2));

    return NextResponse.json(
      {
        message: "Balances de activos específicos obtenidos con éxito de Binance.",
        balances: specificBalances,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("[API/Binance/Balance] Error al obtener balances:", error);

    let errorMessage = "Error desconocido al obtener balances de Binance.";
    if (error.response && error.response.data && error.response.data.msg) {
      errorMessage = `Binance API Error: ${error.response.data.msg}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { message: errorMessage, error: errorMessage },
      { status: 500 }
    );
  }
}