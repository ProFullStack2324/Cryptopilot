
"use client";

import { useState, useEffect, useCallback } from 'react';

const BITCOIN_PRICE_UPDATE_INTERVAL_MS = 60000; // Actualizar cada 60 segundos

export function useBitcoinPrice() {
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isLoadingBitcoinPrice, setIsLoadingBitcoinPrice] = useState(true);
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  const fetchBitcoinPrice = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoadingBitcoinPrice(true);
    }
    // No limpiar el error aquí para que persista si las actualizaciones fallan
    // setBitcoinPriceError(null); 

    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) {
        let errorDetails = `Error API CoinGecko: ${response.status}`;
        try {
            const errorData = await response.text();
            errorDetails += ` - ${errorData.substring(0, 100)}`; // Limitar longitud del mensaje de error
        } catch (e) {
            // No hacer nada si no se puede leer el cuerpo del error
        }
        console.error("Error al obtener precio de Bitcoin (fetchBitcoinPrice):", errorDetails);
        throw new Error(errorDetails);
      }
      const data = await response.json();
      if (data.bitcoin && data.bitcoin.usd) {
        setBitcoinPrice(data.bitcoin.usd);
        setBitcoinPriceError(null); // Limpiar error solo si fue exitoso
      } else {
        console.error('Respuesta de API CoinGecko inesperada (fetchBitcoinPrice):', data);
        throw new Error('Respuesta de API CoinGecko inesperada');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener precio BTC';
      console.error("Error en fetchBitcoinPrice hook:", errorMessage, error);
      setBitcoinPriceError(errorMessage);
      // No poner setBitcoinPrice(null) aquí, para mantener el último precio conocido si una actualización falla
    } finally {
      if (isInitialLoad) {
        setIsLoadingBitcoinPrice(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchBitcoinPrice(true); // Carga inicial
    const intervalId = setInterval(() => fetchBitcoinPrice(false), BITCOIN_PRICE_UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchBitcoinPrice]);

  return { bitcoinPrice, isLoadingBitcoinPrice, bitcoinPriceError };
}
