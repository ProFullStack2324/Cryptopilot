// src/components/dashboard/bot-status-flow.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader, XCircle, PlayCircle, Search, Target } from "lucide-react";
import React from 'react';
import { BotOpenPosition } from "@/lib/types";

interface BotStatusFlowProps {
    isBotRunning: boolean;
    rulesLoading: boolean;
    balancesLoading: boolean;
    candleCount: number;
    requiredCandles: number;
    botOpenPosition: BotOpenPosition | null;
}

const StatusStep = ({
    title,
    description,
    isCurrent,
    isCompleted,
}: {
    title: string;
    description: string;
    isCurrent: boolean;
    isCompleted: boolean;
}) => {
    const Icon = isCompleted ? CheckCircle : isCurrent ? Loader : PlayCircle;
    const colorClass = isCompleted ? 'text-green-500' : isCurrent ? 'text-blue-500' : 'text-muted-foreground';
    const iconClass = isCurrent ? 'animate-spin' : '';

    return (
        <li className="flex items-start gap-4">
            <div className={`flex flex-col items-center ${colorClass}`}>
                <Icon className={`w-6 h-6 ${iconClass}`} />
                <div className="w-px h-full bg-border mt-1"></div>
            </div>
            <div className={`pt-1 pb-4 ${isCurrent ? 'font-semibold' : ''}`}>
                <h4 className={`text-sm ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</h4>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </li>
    );
};

export const BotStatusFlow: React.FC<BotStatusFlowProps> = ({
    isBotRunning,
    rulesLoading,
    balancesLoading,
    candleCount,
    requiredCandles,
    botOpenPosition,
}) => {
    const isRulesLoaded = !rulesLoading;
    const isBalancesLoaded = !balancesLoading;
    const areCandlesLoaded = candleCount >= requiredCandles;

    let currentStep = 0;
    if (isRulesLoaded) currentStep = 1;
    if (isRulesLoaded && isBalancesLoaded) currentStep = 2;
    if (isRulesLoaded && isBalancesLoaded && areCandlesLoaded) currentStep = 3;
    if (isBotRunning && areCandlesLoaded) currentStep = 4;
    if (botOpenPosition) currentStep = 5;

    const steps = [
        {
            title: "Cargando Reglas",
            description: "Obteniendo reglas del mercado de Binance.",
            isCompleted: isRulesLoaded,
            isCurrent: currentStep === 0,
        },
        {
            title: "Cargando Balances",
            description: "Consultando balances de tu cuenta.",
            isCompleted: isBalancesLoaded,
            isCurrent: currentStep === 1,
        },
        {
            title: "Recolectando Velas",
            description: `Recolectando datos de velas (${candleCount}/${requiredCandles}).`,
            isCompleted: areCandlesLoaded,
            isCurrent: currentStep === 2 && !areCandlesLoaded,
        },
        {
            title: "Listo para Iniciar",
            description: "El bot está listo para ser activado.",
            isCompleted: isBotRunning,
            isCurrent: currentStep === 3 && !isBotRunning,
        },
        {
            title: botOpenPosition ? "Posición Abierta" : "Bot Activo",
            description: botOpenPosition
                ? `Posición abierta en ${botOpenPosition.marketId}. Monitoreando salida.`
                : "Buscando la próxima oportunidad de trade.",
            isCompleted: !!botOpenPosition,
            isCurrent: isBotRunning && !botOpenPosition,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Estado Actual del Bot</CardTitle>
                <CardDescription>Flujo de operación en tiempo real.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="relative">
                    {steps.map((step, index) => (
                        <StatusStep
                            key={index}
                            title={step.title}
                            description={step.description}
                            isCompleted={step.isCompleted}
                            isCurrent={step.isCurrent}
                        />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};
