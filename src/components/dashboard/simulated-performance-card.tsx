// src/components/dashboard/simulated-performance-card.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BotOpenPosition, Market } from '@/lib/types';
import { Beaker, TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import clsx from 'clsx';

interface SimulatedPerformanceCardProps {
    simulatedPosition: BotOpenPosition | null;
    currentPrice: number | null;
    market: Market | null;
}

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

export function SimulatedPerformanceCard({ simulatedPosition, currentPrice, market }: SimulatedPerformanceCardProps) {
    if (!simulatedPosition || !currentPrice || !market) {
        return null; // No mostrar nada si no hay una posición simulada activa
    }

    const { entryPrice, amount, takeProfitPrice, stopLossPrice, strategy } = simulatedPosition;
    const pricePrecision = market.pricePrecision;
    const quoteAsset = market.quoteAsset;

    const pnl = (currentPrice - entryPrice) * amount;
    const pnlPercentage = (pnl / (entryPrice * amount)) * 100;

    let simulationStatus = "Monitoreando...";
    let statusColor = "text-blue-500";

    if (isValidNumber(takeProfitPrice) && currentPrice >= takeProfitPrice) {
        simulationStatus = "Venta Simulada por Take Profit";
        statusColor = "text-green-500";
    } else if (isValidNumber(stopLossPrice) && currentPrice <= stopLossPrice) {
        simulationStatus = "Venta Simulada por Stop Loss";
        statusColor = "text-red-500";
    }

    return (
        <Card className="lg:col-span-3 shadow-lg rounded-xl border-dashed border-blue-500 bg-blue-500/5">
            <CardHeader>
                <CardTitle className="flex items-center text-blue-400">
                    <Beaker className="w-5 h-5 mr-2" />
                    Simulador de Oportunidad Perdida
                </CardTitle>
                <CardDescription>
                    Rendimiento de la última señal de compra que no se ejecutó por falta de fondos.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                    <p><strong>Estrategia:</strong> <span className="font-semibold capitalize">{strategy}</span></p>
                    <p><strong>Entrada Simulada:</strong> {entryPrice.toFixed(pricePrecision)} {quoteAsset}</p>
                    <p><strong>Precio Actual:</strong> {currentPrice.toFixed(pricePrecision)} {quoteAsset}</p>
                </div>
                <div className="space-y-2">
                    <p className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-500" />
                        <strong>Take Profit:</strong> {takeProfitPrice?.toFixed(pricePrecision) || 'N/A'}
                    </p>
                    <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-500" />
                        <strong>Stop Loss:</strong> {stopLossPrice?.toFixed(pricePrecision) || 'N/A'}
                    </p>
                    <p className={`font-bold ${statusColor}`}>{simulationStatus}</p>
                </div>
                <div className="flex flex-col items-center justify-center space-y-1">
                    <p className="text-lg font-bold">PnL Flotante (Simulado)</p>
                    <p className={clsx("text-2xl font-bold", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                        {pnl.toFixed(2)} {quoteAsset}
                    </p>
                    <p className={clsx("flex items-center gap-1 text-sm font-semibold", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                        {pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {pnlPercentage.toFixed(2)}%
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
