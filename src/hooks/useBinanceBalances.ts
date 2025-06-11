
// src/hooks/useBinanceBalances.ts
import { useState, useEffect, useCallback } from 'react';
import type { Balance, UseBinanceBalancesProps } from '@/lib/types'; // Importar Balance y props del hook

type AllBalances = Record<string, Balance>;

const useBinanceBalances = ({
  initialFetch = true,
  fetchIntervalMs,
}: UseBinanceBalancesProps) => { // useTestnet eliminado de props
  const [balances, setBalances] = useState<AllBalances | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    setIsLoadingBalances(true);
    setBalancesError(null);
    console.log(`[useBinanceBalances] Iniciando fetch de balances en Mainnet.`);

    const endpoint = '/api/binance/balance'; // Endpoint unificado, ahora siempre para Mainnet

    try {
        console.log(`[useBinanceBalances] Llamando al endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Ya no se envía isTestnet en el body
        });

        console.log(`[useBinanceBalances] Respuesta de balances recibida. Estado: ${response.status}`);
        const result = await response.json();
        console.log(`[useBinanceBalances] Resultado de balances:`, result);

        if (!response.ok || !result.success) {
            console.error(`[useBinanceBalances] El endpoint ${endpoint} reportó un error o fallo al obtener balances.`);
            const errorDetails = result.message || result.details || `Error HTTP: ${response.status}`;
            setBalancesError(errorDetails);
            setBalances(null);
        } else {
            console.log(`[useBinanceBalances] Balances obtenidos con éxito de Mainnet. Cantidad de activos: ${Object.keys(result.balances || {}).length}`);
            setBalances(result.balances as AllBalances);
        }
    } catch (fetchError: any) {
        console.error(`[useBinanceBalances] Error en la llamada fetch al endpoint ${endpoint}:`, fetchError);
        const errorDetails = `Error de red o inesperado al obtener balances en Mainnet: ${fetchError.message || 'Error desconocido'}`;
        setBalancesError(errorDetails);
        setBalances(null);
    } finally {
        setIsLoadingBalances(false);
        console.log(`[useBinanceBalances] Finalizado el fetch de balances en Mainnet.`);
    }
  }, []); // Dependencias vacías, ya no depende de useTestnet

  useEffect(() => {
    console.log(`[useBinanceBalances] Efecto de carga inicial/polling activado. initialFetch: ${initialFetch}, fetchIntervalMs: ${fetchIntervalMs}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (initialFetch) {
      fetchBalances();
    }

    if (fetchIntervalMs && fetchIntervalMs > 0) {
        console.log(`[useBinanceBalances] Configurando polling automático cada ${fetchIntervalMs / 1000} segundos.`);
        intervalId = setInterval(fetchBalances, fetchIntervalMs);
    } else {
        console.log("[useBinanceBalances] Polling automático no configurado o intervalo inválido.");
    }

    return () => {
      console.log("[useBinanceBalances] Función de limpieza del efecto de balances activada.");
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[useBinanceBalances] Intervalo de polling de balances limpiado.");
      }
    };
  }, [fetchBalances, initialFetch, fetchIntervalMs]);

  return {
    balances,
    isLoadingBalances,
    balancesError,
    fetchBalances,
  };
};

export default useBinanceBalances;
