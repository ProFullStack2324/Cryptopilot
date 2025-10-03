// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot',
    'adjustForTimeDifference': true,
  },
  enableRateLimit: true,
});

export async function POST(req: Request) {
  const networkType = 'Mainnet';
  console.log(`[API/Binance/Balance] Usando configuración para la red: ${networkType}`);

  // --- Validación de Credenciales ---
  if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
    console.error(`[API/Binance/Balance] Error: Las credenciales de ${networkType} no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance ${networkType} no están configuradas en .env.local.`
    }, { status: 500 });
  }
  console.log(`[API/Binance/Balance] Credenciales de ${networkType} cargadas correctamente.`);

  // --- Obtener Balances usando CCXT ---
  try {
    console.log(`[API/Binance/Balance] Solicitando balances a CCXT en ${networkType}...`);

    const accountBalance = await exchangeMainnet.fetchBalance();

    console.log(`[API/Binance/Balance] Balances obtenidos de CCXT en ${networkType}.`);

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};
    
    // En spot, el balance se reporta en 'total', 'used', 'free' por cada activo.
    if (accountBalance && accountBalance.total) {
        Object.keys(accountBalance.total).forEach(asset => {
            const total = accountBalance.total[asset] || 0;
            if (total > 0) {
                 balancesFormatted[asset] = {
                    available: accountBalance.free[asset] || 0,
                    onOrder: accountBalance.used[asset] || 0,
                    total: total,
                };
            }
        });
    }


    console.log(`[API/Binance/Balance] ${Object.keys(balancesFormatted).length} activos con saldo > 0 formateados.`);

    return NextResponse.json({
      success: true,
      message: `Balances de cuenta obtenidos con éxito de Binance ${networkType}.`,
      balances: balancesFormatted,
      timestamp: accountBalance.timestamp,
      datetime: accountBalance.datetime,
    });

  } catch (error: any) {
    console.error(`[API/Binance/Balance] Error al obtener balances con CCXT en ${networkType}:`, error);

    let userMessage = `Error al obtener los balances de la cuenta en Binance ${networkType}.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;

    if (error instanceof ccxt.AuthenticationError) {
        userMessage = "Error de autenticación. Verifica tus claves API de Mainnet.";
        statusCode = 401;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance Mainnet.";
        statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
        // Capturar específicamente el error de restricción geográfica
        if (error.message.includes('Service unavailable from a restricted location')) {
            userMessage = "Servicio no disponible desde una ubicación restringida.";
            details = "La API de Binance Spot está restringiendo el acceso desde la ubicación del servidor. Este es un bloqueo geográfico de Binance.";
            statusCode = 403; // Forbidden
        } else {
            userMessage = "Ocurrió un error en el exchange de Binance al obtener balances.";
            details = error.message;
        }
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
