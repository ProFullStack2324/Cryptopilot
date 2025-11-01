// src/components/dashboard/performance-metrics-card.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { DollarSign, TrendingUp, TrendingDown, CircleDashed, BarChart, Target, Beaker } from "lucide-react";
import clsx from 'clsx';

const MetricItem = ({ icon: Icon, label, value, unit = '', colorClass, isLoading }: { icon: React.ElementType, label: string, value: number | string, unit?: string, colorClass: string, isLoading: boolean }) => (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-background/50 text-center">
        <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        {isLoading ? (
            <Skeleton className="h-6 w-20" />
        ) : (
            <p className={clsx("text-lg font-bold", colorClass)}>
                {value}{unit}
            </p>
        )}
    </div>
);

export function PerformanceMetricsCard() {
    const { metrics, isLoading, error } = usePerformanceMetrics();

    const formatCurrency = (value: number | undefined) => {
        if (typeof value !== 'number') return '$0.00';
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (error) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-base">Métricas de Rendimiento</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-full">
                    <p className="text-sm text-destructive">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                    <BarChart className="w-4 h-4 mr-2" />
                    Métricas de Rendimiento del Bot
                </CardTitle>
                <CardDescription className="text-xs">
                    Análisis de operaciones reales y simuladas.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {/* Columna Real */}
                    <div className="p-2 rounded-lg border border-green-500/30 bg-green-500/5 space-y-2">
                        <h4 className="text-center text-xs font-semibold text-green-400">Rendimiento Real</h4>
                        <MetricItem 
                            icon={TrendingUp}
                            label="Ganancias"
                            value={formatCurrency(metrics?.realGains)}
                            colorClass="text-green-500"
                            isLoading={isLoading}
                        />
                        <MetricItem 
                            icon={TrendingDown}
                            label="Pérdidas"
                            value={formatCurrency(metrics?.realLosses)}
                            colorClass="text-red-500"
                            isLoading={isLoading}
                        />
                        <MetricItem 
                            icon={DollarSign}
                            label="Neto"
                            value={formatCurrency(metrics?.realNet)}
                            colorClass={clsx({ 'text-green-500': (metrics?.realNet ?? 0) >= 0, 'text-red-500': (metrics?.realNet ?? 0) < 0 })}
                            isLoading={isLoading}
                        />
                    </div>
                     {/* Columna Simulada */}
                    <div className="p-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-2">
                        <h4 className="text-center text-xs font-semibold text-cyan-400">Rendimiento Simulado</h4>
                        <MetricItem 
                            icon={Beaker}
                            label="Ganancias"
                            value={formatCurrency(metrics?.simulatedGains)}
                            colorClass="text-cyan-400"
                            isLoading={isLoading}
                        />
                        <MetricItem 
                            icon={TrendingDown}
                            label="Pérdidas"
                            value={formatCurrency(metrics?.simulatedLosses)}
                            colorClass="text-orange-400"
                            isLoading={isLoading}
                        />
                        <MetricItem 
                            icon={CircleDashed}
                            label="Neto"
                            value={formatCurrency(metrics?.simulatedNet)}
                            colorClass={clsx({ 'text-cyan-400': (metrics?.simulatedNet ?? 0) >= 0, 'text-orange-400': (metrics?.simulatedNet ?? 0) < 0 })}
                            isLoading={isLoading}
                        />
                    </div>
                     {/* Columna Total */}
                    <div className="col-span-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 flex flex-col justify-center">
                         <h4 className="text-center text-xs font-semibold text-amber-400 mb-2">Total Consolidado</h4>
                        <MetricItem 
                            icon={Target}
                            label="Tasa de Éxito (Total)"
                            value={isLoading ? '...' : (metrics?.effectivenessRate ?? 0).toFixed(1)}
                            unit="%"
                            colorClass="text-amber-500"
                            isLoading={isLoading}
                        />
                         <p className="text-[10px] text-center text-muted-foreground mt-1">
                            Basado en {isLoading ? '...' : metrics?.totalTrades} operaciones ({isLoading ? '...' : metrics?.winningTrades} ganadoras).
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
