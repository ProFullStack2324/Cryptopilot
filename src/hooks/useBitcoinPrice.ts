
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

const BITCOIN_PRICE_UPDATE_INTERVAL_MS = 60000; // Actualizar cada 60 segundos

export function useBitcoinPrice() {
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isLoadingBitcoinPrice, setIsLoadingBitcoinPrice] = useState(true);
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Componente montado
    isMountedRef.current = true;
    // Función de limpieza al desmontar
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Se ejecuta solo al montar y desmontar

  const fetchBitcoinPrice = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad && isMountedRef.current) {
      setIsLoadingBitcoinPrice(true);
    }
    
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) {
        let errorDetails = `Error API CoinGecko: ${response.status}`;
        try {
            const errorDataText = await response.text();
            errorDetails += ` - ${errorDataText.substring(0, 100)}`;
        } catch (e) {
            // No hacer nada si no se puede leer el cuerpo del error, usar solo el status
        }
        console.error("Error al obtener precio de Bitcoin (fetchBitcoinPrice - API Error):", errorDetails);
        throw new Error(errorDetails);
      }

      const data = await response.json();

      if (data.bitcoin && typeof data.bitcoin.usd === 'number') {
        if (isMountedRef.current) {
          setBitcoinPrice(data.bitcoin.usd);
          setBitcoinPriceError(null); // Limpiar errores previos si la llamada es exitosa
        }
      } else {
        console.error('Respuesta de API CoinGecko inesperada (fetchBitcoinPrice):', data);
        if (isMountedRef.current) {
          setBitcoinPriceError('Respuesta de API CoinGecko inesperada');
          // Considerar si se debe limpiar el precio: setBitcoinPrice(null);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener precio BTC';
      console.error("Error en fetchBitcoinPrice hook (catch general):", errorMessage, error);
      if (isMountedRef.current) {
        setBitcoinPriceError(errorMessage);
        // Considerar limpiar el precio en caso de error: setBitcoinPrice(null);
      }
    } finally {
      if (isInitialLoad && isMountedRef.current) {
        setIsLoadingBitcoinPrice(false);
      }
    }
  }, []); // Las funciones set de useState son estables, no necesitan estar en dependencias.

  useEffect(() => {
    fetchBitcoinPrice(true); // Carga inicial
    const intervalId = setInterval(() => fetchBitcoinPrice(false), BITCOIN_PRICE_UPDATE_INTERVAL_MS);
    
    return () => {
      clearInterval(intervalId); // Limpiar intervalo al desmontar
    };
  }, [fetchBitcoinPrice]); // fetchBitcoinPrice está memoizada y es estable

  return { bitcoinPrice, isLoadingBitcoinPrice, bitcoinPriceError };
}

