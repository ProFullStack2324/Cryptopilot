
// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Configuración de CCXT para Mainnet ÚNICAMENTE
const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    'defaultType': 'spot', // O 'future' si operas principalmente en futuros
  },
});

export async function POST(req: Request) {
  // La lógica de isTestnet y networkType se elimina
  console.log(`[API/Binance/Balance Mainnet] Recibida solicitud de balances en Mainnet.`);

  // Ya no se espera 'isTestnet' en el cuerpo, si se envía, se ignora.
  // try {
  //   const requestBody: { isTestnet?: boolean } = await req.json(); // Simple parse
  // } catch (jsonError: any) {
  //   // Si el cuerpo no es JSON o está vacío, no es un problema si no esperamos nada específico.
  //   console.log("[API/Binance/Balance Mainnet] Solicitud POST sin cuerpo JSON o con cuerpo inválido, procediendo...");
  // }

  if (exchangeMainnet.apiKey === undefined || exchangeMainnet.secret === undefined) {
    console.error(`[API/Binance/Balance Mainnet] Error: Las credenciales de Mainnet no están configuradas.`);
    return NextResponse.json({
      success: false,
      message: `Las credenciales de Binance Mainnet no están configuradas en las variables de entorno (.env.local).`
    }, { status: 500 });
  }
  console.log(`[API/Binance/Balance Mainnet] Credenciales de Mainnet cargadas correctamente.`);

  try {
    console.log(`[API/Binance/Balance Mainnet] Solicitando balances a CCXT en Mainnet...`);
    const accountBalance = await exchangeMainnet.fetchBalance();
    console.log(`[API/Binance/Balance Mainnet] Balances obtenidos de CCXT en Mainnet.`);
    // console.log(JSON.stringify(accountBalance, null, 2));

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};
    if (accountBalance && accountBalance.total) {
      const totalBalances = accountBalance.total as unknown as Record<string, number>;
      const freeBalances = accountBalance.free as unknown as Record<string, number>;
      const usedBalances = accountBalance.used as unknown as Record<string, number>;

      for (const asset in totalBalances) {
        if (Object.prototype.hasOwnProperty.call(totalBalances, asset)) {
          const total = totalBalances[asset];
          const free = freeBalances[asset];
          const used = usedBalances[asset];
          if (total > 0) {
            balancesFormatted[asset] = {
              available: free,
              onOrder: used,
              total: total,
            };
          }
        }
      }
    }
    console.log(`[API/Binance/Balance Mainnet] ${Object.keys(balancesFormatted).length} activos con saldo > 0 formateados.`);
    return NextResponse.json({
      success: true,
      message: `Balances de cuenta obtenidos con éxito de Binance Mainnet.`,
      balances: balancesFormatted,
      timestamp: accountBalance.timestamp,
      datetime: accountBalance.datetime,
    });
  } catch (error: any) {
    console.error(`[API/Binance/Balance Mainnet] Error al obtener balances con CCXT en Mainnet:`, error);
    let userMessage = `Error al obtener los balances de la cuenta en Binance Mainnet.`;
    let details = error.message || 'Error desconocido';
    let statusCode = 500;
    let binanceErrorCode = undefined;

    if (error instanceof ccxt.NetworkError) {
      userMessage = "Error de conexión con la API de Binance. Intenta de nuevo más tarde.";
      statusCode = 503;
    } else if (error instanceof ccxt.AuthenticationError) {
      userMessage = "Error de autenticación con la API de Binance. Verifica tus claves API.";
      statusCode = 401;
    } else if (error instanceof ccxt.ExchangeError) {
      userMessage = "Ocurrió un error en el exchange de Binance al obtener balances.";
      if (error.message.includes('code=')) {
        const codeMatch = error.message.match(/code=(-?\d+)/);
        if (codeMatch && codeMatch[1]) {
          binanceErrorCode = parseInt(codeMatch[1], 10);
        }
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
