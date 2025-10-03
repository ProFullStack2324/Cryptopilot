// src/app/api/binance/balance/route.ts
import { NextResponse } from 'next/server';
import { exchange } from '@/lib/binance-client'; // Importar cliente centralizado
import ccxt from 'ccxt';

export async function POST(req: Request) {
  const networkType = 'Futures Testnet';
  console.log(`[API/Binance/Balance] Usando configuración para la red: ${networkType}`);

  // --- Validación de Credenciales ---
  if (!exchange.apiKey || !exchange.secret) {
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

    const accountBalance = await exchange.fetchBalance();

    console.log(`[API/Binance/Balance] Balances obtenidos de CCXT en ${networkType}.`);

    const balancesFormatted: Record<string, { available: number; onOrder: number; total: number }> = {};
    
    // En futuros, el balance se reporta de forma diferente. El activo principal suele ser USDT o BUSD.
    if (accountBalance && accountBalance.info && Array.isArray(accountBalance.info.assets)) {
        accountBalance.info.assets.forEach((asset: any) => {
            const total = parseFloat(asset.walletBalance);
            const available = parseFloat(asset.availableBalance);
            if (total > 0) {
                balancesFormatted[asset.asset] = {
                    available: available,
                    onOrder: total - available,
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
        userMessage = "Error de autenticación. Verifica tus claves API de Testnet.";
        statusCode = 401;
    } else if (error instanceof ccxt.NetworkError) {
        userMessage = "Error de conexión con la API de Binance Testnet.";
        statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
        userMessage = "Ocurrió un error en el exchange de Binance al obtener balances.";
        details = error.message;
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      details: details,
    }, { status: statusCode });
  }
}
