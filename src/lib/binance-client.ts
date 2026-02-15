// src/lib/binance-client.ts
import ccxt from 'ccxt';

// Instancia centralizada para la conexión a Binance Mainnet Spot.
// Se utilizará en todos los endpoints de la API para asegurar consistencia.
export const exchangeMainnet = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET_KEY,
  options: {
    defaultType: 'spot', // Asegura que todas las llamadas por defecto vayan a la API de Spot
    adjustForTimeDifference: true, // Sincroniza la hora automáticamente
  },
  enableRateLimit: true,
});
