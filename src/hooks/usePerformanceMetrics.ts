// src/hooks/usePerformanceMetrics.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from './use-toast';

export interface PerformanceMetrics {
    simulatedGains: number;
    simulatedLosses: number;
    simulatedNet: number;
    realGains: number;
    realLosses: number;
    realNet: number;
    effectivenessRate: number;
    totalTrades: number;
    winningTrades: number;
}

export const usePerformanceMetrics = () => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/stats/performance');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error HTTP ${response.status}`);
            }
            const data: PerformanceMetrics = await response.json();
            setMetrics(data);
        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error al Cargar Métricas",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 60000); // Actualizar cada 60 segundos
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    return { metrics, isLoading, error, refreshMetrics: fetchMetrics };
};
