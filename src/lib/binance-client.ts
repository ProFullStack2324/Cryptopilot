// src/lib/binance-client.ts
import ccxt from 'ccxt';

// Instancia centralizada para la conexión a Binance Mainnet
// Se utilizará en todos los endpoints de la API para asegurar consistencia.
export const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    defaultType: 'spot',
    adjustForTimeDifference: true, // Sincroniza la hora automáticamente
  },
  enableRateLimit: true,
});
