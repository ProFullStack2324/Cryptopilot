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

export async function GET(req: Request) {
  console.log(`[API/Binance/Balance] Usando configuración para la red Mainnet`);

  if (!exchangeMainnet.apiKey || !exchangeMainnet.secret) {
    console.error(`[API/Binance/Balance] Error: Las credenciales de Mainnet no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance Mainnet no están configuradas en .env.local.`
    }, { status: 500 });
  }

  try {
    const accountBalance = await exchangeMainnet.fetchBalance();

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};
    
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

    return NextResponse.json({
      success: true,
      message: `Balances de cuenta obtenidos con éxito de Binance Mainnet.`,
      balances: balancesFormatted,
    });

  } catch (error: any) {
    console.error(`[API/Binance/Balance] Error al obtener balances con CCXT en Mainnet:`, error);
    let userMessage = `Error al obtener los balances de la cuenta en Binance Mainnet.`;
    let statusCode = 500;

    if (error.message.includes('Service unavailable from a restricted location')) {
        userMessage = "Servicio no disponible: La API de Binance está restringiendo el acceso desde la ubicación del servidor.";
        statusCode = 403;
    } else if (error instanceof ccxt.AuthenticationError) {
        userMessage = "Error de autenticación. Verifica tus claves API de Mainnet.";
        statusCode = 401;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance Mainnet.";
        statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
        userMessage = `Ocurrió un error en el exchange de Binance: ${error.message}`;
        statusCode = 502;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: error.message,
    }, { status: statusCode });
  }
}
