// src/hooks/useSimulationHistory.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from './use-toast';
import { BotOpenPosition } from '@/lib/types'; // Asegúrate de tener este tipo

// Extiende BotOpenPosition para incluir los campos de una simulación cerrada
export interface ClosedSimulation extends BotOpenPosition {
    _id: string;
    status: 'closed';
    exitPrice: number;
    exitReason: string;
    finalPnl: number;
    closedAt: string; // O Date, dependiendo de cómo lo guardes
    startedAt: string;
}

export const useSimulationHistory = (refreshInterval: number = 30000) => {
    const [simulationHistory, setSimulationHistory] = useState<ClosedSimulation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        // No establecer isLoading a true en cada fetch para evitar parpadeos,
        // solo en la carga inicial.
        setError(null);
        try {
            const response = await fetch('/api/simulations/history');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            const data = await response.json();
            if(data.success) {
                setSimulationHistory(data.simulations);
            } else {
                throw new Error(data.message || "La API de historial de simulaciones no tuvo éxito.");
            }
        } catch (err: any) {
            setError(err.message);
            // Evitar notificar con toast en cada fallo de intervalo
            // toast({
            //     title: "Error al Cargar Historial de Simulaciones",
            //     description: err.message,
            //     variant: "destructive"
            // });
        } finally {
            setIsLoading(false); // Solo se establece a false después del primer fetch
        }
    }, []);

    useEffect(() => {
        fetchHistory(); // Carga inicial
        const interval = setInterval(fetchHistory, refreshInterval); // Actualización periódica
        return () => clearInterval(interval);
    }, [fetchHistory, refreshInterval]);

    return { simulationHistory, isLoading, error, refreshHistory: fetchHistory };
};
