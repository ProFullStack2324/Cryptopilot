// src/hooks/useSignalHistory.ts
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define la estructura de un log de señal que esperamos de la API
export interface SignalLog {
    _id: string;
    timestamp: number;
    message: string;
    success?: boolean;
    details?: {
        strategyMode: 'scalping' | 'sniper';
        buyConditionsCount: number;
        conditions: {
            price: boolean;
            rsi: boolean;
            macd: boolean;
        };
        price?: number; // Precio al que se detectó la señal
    };
    serverTimestamp: string;
}

export const useSignalHistory = (refreshInterval: number = 15000) => { // Actualizar cada 15 segundos
    const [signalHistory, setSignalHistory] = useState<SignalLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        // No establecer isLoading a true en cada fetch para evitar parpadeos,
        // solo en la carga inicial (manejado por el estado inicial de isLoading).
        setError(null);
        try {
            const response = await fetch('/api/signals/history');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                setSignalHistory(data.logs);
            } else {
                throw new Error(data.message || "La API de historial de señales no tuvo éxito.");
            }
        } catch (err: any) {
            setError(err.message);
            // No usamos toast aquí para evitar spam en caso de fallos de red intermitentes
        } finally {
            if (isLoading) setIsLoading(false); // Solo cambia isLoading en la primera carga
        }
    }, [isLoading]); // Dependencia para poder cambiar isLoading

    useEffect(() => {
        fetchHistory(); // Carga inicial
        const interval = setInterval(fetchHistory, refreshInterval);
        return () => clearInterval(interval);
    }, [fetchHistory, refreshInterval]);

    return { signalHistory, isLoading, error, refreshHistory: fetchHistory };
};
