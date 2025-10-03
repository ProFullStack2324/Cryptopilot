// src/lib/binance-client.ts
import ccxt from 'ccxt';

// Instancia centralizada y única para el cliente de Binance.
// Configurada para el TESTNET DE FUTUROS para evitar restricciones geográficas.
export const exchange = new ccxt.binance({
  apiKey: process.env.BINANCE_TESTNET_API_KEY,
  secret: process.env.BINANCE_TESTNET_SECRET_KEY,
  options: {
    // Apuntar a los mercados de Futuros
    'defaultType': 'future',
    'adjustForTimeDifference': true,
  },
  urls: {
    // URLs específicas para la API de Testnet de Futuros (USD-M)
    'api': {
      'public': 'https://testnet.binancefuture.com/fapi/v1',
      'private': 'https://testnet.binancefuture.com/fapi/v1',
    },
  },
  enableRateLimit: true,
});

console.log("Binance client initialized for FUTURES TESTNET.");
