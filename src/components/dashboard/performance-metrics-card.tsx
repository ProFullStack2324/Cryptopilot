// src/components/dashboard/performance-metrics-card.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { DollarSign, TrendingUp, TrendingDown, CircleDashed, BarChart, Target } from "lucide-react";
import clsx from 'clsx';

const MetricItem = ({ icon: Icon, label, value, unit = '', colorClass, isLoading }: { icon: React.ElementType, label: string, value: number | string, unit?: string, colorClass: string, isLoading: boolean }) => (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-background/50">
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
            <Card className="md:col-span-2 lg:col-span-2">
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
        <Card className="md:col-span-2 lg:col-span-2">
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <MetricItem 
                        icon={TrendingUp}
                        label="Ganancia Real"
                        value={formatCurrency(metrics?.realGains)}
                        colorClass="text-green-500"
                        isLoading={isLoading}
                    />
                    <MetricItem 
                        icon={TrendingDown}
                        label="Pérdida Real"
                        value={formatCurrency(metrics?.realLosses)}
                        colorClass="text-red-500"
                        isLoading={isLoading}
                    />
                    <MetricItem 
                        icon={DollarSign}
                        label="Neto Real"
                        value={formatCurrency(metrics?.realNet)}
                        colorClass={clsx({ 'text-green-500': (metrics?.realNet ?? 0) >= 0, 'text-red-500': (metrics?.realNet ?? 0) < 0 })}
                        isLoading={isLoading}
                    />
                    <MetricItem 
                        icon={TrendingUp}
                        label="Ganancia Sim."
                        value={formatCurrency(metrics?.simulatedGains)}
                        colorClass="text-cyan-400"
                        isLoading={isLoading}
                    />
                    <MetricItem 
                        icon={TrendingDown}
                        label="Pérdida Sim."
                        value={formatCurrency(metrics?.simulatedLosses)}
                        colorClass="text-orange-400"
                        isLoading={isLoading}
                    />
                    <MetricItem 
                        icon={CircleDashed}
                        label="Neto Sim."
                        value={formatCurrency(metrics?.simulatedNet)}
                        colorClass={clsx({ 'text-cyan-400': (metrics?.simulatedNet ?? 0) >= 0, 'text-orange-400': (metrics?.simulatedNet ?? 0) < 0 })}
                        isLoading={isLoading}
                    />
                </div>
                 <div className="mt-2 border-t pt-2">
                    <MetricItem 
                        icon={Target}
                        label="Tasa de Éxito (Total)"
                        value={isLoading ? '...' : (metrics?.effectivenessRate ?? 0).toFixed(1)}
                        unit="%"
                        colorClass="text-amber-500"
                        isLoading={isLoading}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
