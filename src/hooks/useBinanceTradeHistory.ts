// src/hooks/useBinanceTradeHistory.ts
import { useState, useEffect, useCallback } from 'react';
// Puedes importar tipos si has definido interfaces para las respuestas de tus APIs en otro lugar
// import { TradeHistorySuccessResponse, TradeHistoryErrorResponse } from '../types/api-responses'; // Ejemplo

// Interfaz para la estructura de un trade formateado que esperamos de nuestro endpoint API
interface FormattedTrade {
    id: string;
    orderId: string | undefined;
    symbol: string;
    timestamp: number;
    datetime: string;
    side: 'buy' | 'sell';
    type: string | undefined;
    price: number;
    amount: number;
    cost: number;
    fee?: {
        cost: number;
        currency: string | undefined;
        rate: number | undefined;
    };
    // Añadir otros campos si tu API de backend los devuelve y los necesitas
}

interface UseBinanceTradeHistoryProps {
  initialFetch?: boolean; // Para controlar si se hace un fetch inicial al montar
  // No incluimos polling automático para historial por defecto, suele ser a demanda o en respuesta a eventos
  // fetchIntervalMs?: number;
  useTestnet?: boolean; // Nuevo: Indica si obtener historial de la red de prueba
  symbol?: string; // Opcional: Símbolo específico para filtrar historial
  since?: number; // Opcional: Timestamp en milisegundos para obtener trades desde esa fecha.
  limit?: number; // Opcional: Límite de trades a obtener.
}

const useBinanceTradeHistory = ({
  initialFetch = true,
  useTestnet = false, // Por defecto, obtener historial de mainnet
  symbol, // Parámetro opcional
  since, // Parámetro opcional
  limit, // Parámetro opcional
}: UseBinanceTradeHistoryProps) => {
  const [tradeHistory, setTradeHistory] = useState<FormattedTrade[] | null>(null);
  const [isLoadingTradeHistory, setIsLoadingTradeHistory] = useState(false);
  const [tradeHistoryError, setTradeHistoryError] = useState<string | null>(null);

  // Función para obtener el historial de trades
  const fetchTradeHistory = useCallback(async (fetchParams?: { symbol?: string, since?: number, limit?: number }) => {
    setIsLoadingTradeHistory(true);
    setTradeHistoryError(null); // Limpiar errores anteriores

    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useBinanceTradeHistory] Iniciando fetch de historial de trades en ${networkType}.`);
    console.log(`[useBinanceTradeHistory] Parámetros de fetch: Símbolo=${fetchParams?.symbol || symbol || 'TODOS'}, Since=${fetchParams?.since || since}, Limit=${fetchParams?.limit || limit}`);


    const endpoint = '/api/binance/trade-history'; // Nuestro endpoint de historial de trades

    try {
        console.log(`[useBinanceTradeHistory] Llamando al endpoint: ${endpoint}`);

        // Combinar parámetros de la prop con los parámetros pasados a la función fetchTradeHistory
        const requestBody = {
            isTestnet: useTestnet, // Enviamos la bandera isTestnet en el body
            symbol: fetchParams?.symbol ?? symbol, // Preferir parámetro de la función si existe
            since: fetchParams?.since ?? since,
            limit: fetchParams?.limit ?? limit,
        };

        const response = await fetch(endpoint, {
            method: 'POST', // Usamos POST
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody), // Enviamos los parámetros en el body
        });

        console.log(`[useBinanceTradeHistory] Respuesta de historial de trades recibida. Estado: ${response.status}`);

        const result = await response.json(); // Asumiendo la respuesta: { success: boolean, trades: FormattedTrade[], message: string, details?: string, binanceErrorCode?: number }

        console.log(`[useBinanceTradeHistory] Resultado de historial de trades:`, result);


        if (!response.ok || !result.success) {
            console.error(`[useBinanceTradeHistory] El endpoint ${endpoint} reportó un error o fallo al obtener historial.`);
            const errorDetails = result.message || result.details || `Error HTTP: ${response.status}`;
            setTradeHistoryError(errorDetails);
            setTradeHistory(null); // Limpiar historial en caso de error

        } else {
            console.log(`[useBinanceTradeHistory] Historial de trades obtenido con éxito de ${networkType}. Cantidad de trades: ${result.trades ? result.trades.length : 0}`);
             // Asegurarse de que result.trades tiene el formato esperado (FormattedTrade[])
             setTradeHistory(result.trades as FormattedTrade[]); // Asertar al tipo esperado

        }

    } catch (fetchError: any) {
        console.error(`[useBinanceTradeHistory] Error en la llamada fetch al endpoint ${endpoint}:`, fetchError);
        const errorDetails = `Error de red o inesperado al obtener historial de trades en ${networkType}: ${fetchError.message || 'Error desconocido'}`;
        setTradeHistoryError(errorDetails);
        setTradeHistory(null); // Limpiar historial en caso de error

    } finally {
        setIsLoadingTradeHistory(false);
        console.log(`[useBinanceTradeHistory] Finalizado el fetch de historial de trades en ${networkType}.`);
    }
  }, [useTestnet, symbol, since, limit]); // Dependencias: si cambian los parámetros, el callback cambia


  // useEffect para la carga inicial
  useEffect(() => {
    console.log(`[useBinanceTradeHistory] Efecto de carga inicial activado. initialFetch: ${initialFetch}, useTestnet: ${useTestnet}, symbol: ${symbol}`);

    if (initialFetch) {
      fetchTradeHistory(); // Carga inicial
    }

    // No hay intervalo de limpieza aquí porque no hay polling automático por defecto
  }, [fetchTradeHistory, initialFetch]); // Dependencias

  // El hook devuelve el estado y la función para obtener historial manualmente si se necesita
  return {
    tradeHistory,
    isLoadingTradeHistory,
    tradeHistoryError,
    fetchTradeHistory, // Exponer la función por si se necesita recargar o cambiar parámetros
  };
};

export default useBinanceTradeHistory;
