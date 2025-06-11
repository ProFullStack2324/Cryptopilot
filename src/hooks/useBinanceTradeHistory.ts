
// src/hooks/useBinanceTradeHistory.ts
import { useState, useEffect, useCallback } from 'react';
import type { Trade, UseBinanceTradeHistoryProps } from '@/lib/types'; // Importar Trade y props del hook

const useBinanceTradeHistory = ({
  initialFetch = true,
  symbol,
  since,
  limit,
}: UseBinanceTradeHistoryProps) => { // useTestnet eliminado de props
  const [tradeHistory, setTradeHistory] = useState<Trade[] | null>(null);
  const [isLoadingTradeHistory, setIsLoadingTradeHistory] = useState(false);
  const [tradeHistoryError, setTradeHistoryError] = useState<string | null>(null);

  const fetchTradeHistory = useCallback(async (fetchParams?: { symbol?: string, since?: number, limit?: number }) => {
    setIsLoadingTradeHistory(true);
    setTradeHistoryError(null);

    const currentSymbol = fetchParams?.symbol ?? symbol;
    const currentSince = fetchParams?.since ?? since;
    const currentLimit = fetchParams?.limit ?? limit;

    console.log(`[useBinanceTradeHistory] Iniciando fetch de historial de trades en Mainnet.`);
    console.log(`[useBinanceTradeHistory] Parámetros de fetch: Símbolo=${currentSymbol || 'TODOS'}, Since=${currentSince}, Limit=${currentLimit}`);

    const endpoint = '/api/binance/trade-history';

    try {
        console.log(`[useBinanceTradeHistory] Llamando al endpoint: ${endpoint}`);
        const requestBody = {
            // isTestnet: false, // Ya no se envía, el backend asume Mainnet
            symbol: currentSymbol,
            since: currentSince,
            limit: currentLimit,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        console.log(`[useBinanceTradeHistory] Respuesta de historial de trades recibida. Estado: ${response.status}`);
        const result = await response.json();
        console.log(`[useBinanceTradeHistory] Resultado de historial de trades:`, result);

        if (!response.ok || !result.success) {
            console.error(`[useBinanceTradeHistory] El endpoint ${endpoint} reportó un error o fallo al obtener historial.`);
            const errorDetails = result.message || result.details || `Error HTTP: ${response.status}`;
            setTradeHistoryError(errorDetails);
            setTradeHistory(null);
        } else {
            console.log(`[useBinanceTradeHistory] Historial de trades obtenido con éxito de Mainnet. Cantidad de trades: ${result.trades ? result.trades.length : 0}`);
            setTradeHistory(result.trades as Trade[]);
        }
    } catch (fetchError: any) {
        console.error(`[useBinanceTradeHistory] Error en la llamada fetch al endpoint ${endpoint}:`, fetchError);
        const errorDetails = `Error de red o inesperado al obtener historial de trades en Mainnet: ${fetchError.message || 'Error desconocido'}`;
        setTradeHistoryError(errorDetails);
        setTradeHistory(null);
    } finally {
        setIsLoadingTradeHistory(false);
        console.log(`[useBinanceTradeHistory] Finalizado el fetch de historial de trades en Mainnet.`);
    }
  }, [symbol, since, limit]); // Dependencias principales para el callback

  useEffect(() => {
    console.log(`[useBinanceTradeHistory] Efecto de carga inicial activado. initialFetch: ${initialFetch}, symbol: ${symbol}`);
    if (initialFetch) {
      fetchTradeHistory();
    }
  }, [fetchTradeHistory, initialFetch]);

  return {
    tradeHistory,
    isLoadingTradeHistory,
    tradeHistoryError,
    fetchTradeHistory,
  };
};

export default useBinanceTradeHistory;
