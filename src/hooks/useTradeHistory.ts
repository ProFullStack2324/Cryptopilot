// src/hooks/useTradeHistory.ts
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define la estructura de un log de trade que esperamos de la API
export interface TradeLog {
    _id: string;
    timestamp: number;
    message: string;
    success?: boolean;
    type: string;
    details: {
        side?: 'buy' | 'sell';
        symbol?: string;
        origQty?: number;
        cummulativeQuoteQty?: string;
        price?: number;
        [key: string]: any; // Para otros detalles que puedan venir
    };
    serverTimestamp: string;
}

export const useTradeHistory = (refreshInterval: number = 15000) => { // Actualizar cada 15 segundos
    const [tradeHistory, setTradeHistory] = useState<TradeLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        // No establecer isLoading a true en cada fetch para evitar parpadeos,
        // solo en la carga inicial (manejado por el estado inicial de isLoading).
        setError(null);
        try {
            const response = await fetch('/api/logs/history');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                setTradeHistory(data.logs);
            } else {
                throw new Error(data.message || "La API de historial de trades no tuvo éxito.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (isLoading) setIsLoading(false);
        }
    }, [isLoading]);

    useEffect(() => {
        fetchHistory(); // Carga inicial
        const interval = setInterval(fetchHistory, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchHistory, refreshInterval]);

    return { tradeHistory, isLoading, error, refreshHistory: fetchHistory };
};
