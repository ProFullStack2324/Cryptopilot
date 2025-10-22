// src/components/dashboard/bot-status-flow.tsx
"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import { CheckCircle, Loader, Search, PlayCircle, Bot } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BotStatusFlowProps {
    isBotRunning: boolean;
    dataLoadedCount: number;
    requiredDataCount: number;
}

interface StepProps {
    icon: React.ElementType;
    title: string;
    description: string;
    status: 'completed' | 'active' | 'pending';
    progress?: number;
}

const StatusStep = ({ icon: Icon, title, description, status, progress }: StepProps) => {
    const isCompleted = status === 'completed';
    const isActive = status === 'active';
    const isPending = status === 'pending';

    return (
        <div className="flex items-start gap-4">
            <div className={cn(
                "flex flex-col items-center",
                isCompleted ? "text-green-500" : isActive ? "text-blue-500" : "text-muted-foreground"
            )}>
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2",
                    isCompleted ? "bg-green-100 border-green-500" :
                    isActive ? "bg-blue-100 border-blue-500 animate-pulse" :
                    "bg-muted border-border"
                )}>
                    <Icon className="w-4 h-4" />
                </div>
                { (status === 'active' || status === 'completed') && <div className="mt-2 w-0.5 h-8 bg-border" />}
            </div>
            <div className="pt-1">
                <p className={cn(
                    "font-semibold",
                    isCompleted ? "text-green-600 dark:text-green-400" : 
                    isActive ? "text-blue-600 dark:text-blue-400" : 
                    "text-muted-foreground"
                )}>
                    {title}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
                {isActive && typeof progress === 'number' && (
                     <div className="mt-1">
                        <Progress value={progress} className="h-1 w-full" />
                    </div>
                )}
            </div>
        </div>
    );
};


export function BotStatusFlow({ isBotRunning, dataLoadedCount, requiredDataCount }: BotStatusFlowProps) {
    
    const isHunting = isBotRunning && dataLoadedCount >= requiredDataCount;

    let step1Status: StepProps['status'] = 'pending';
    let step2Status: StepProps['status'] = 'pending';
    let step3Status: StepProps['status'] = 'pending';

    let step2Description = `Esperando inicio del bot...`;
    let step2Progress = 0;

    if (isBotRunning) {
        step1Status = 'completed';
        if (dataLoadedCount < requiredDataCount) {
            step2Status = 'active';
            step2Description = `Recolectando velas (${dataLoadedCount}/${requiredDataCount})`;
            step2Progress = (dataLoadedCount / requiredDataCount) * 100;
        } else {
            step2Status = 'completed';
            step2Description = `Datos suficientes recolectados (${requiredDataCount}/${requiredDataCount})`;
            step3Status = 'active';
        }
    }

    if (isHunting) {
        step3Status = 'active';
    }
    
    if (!isBotRunning) {
        step1Status = 'pending';
        step2Status = 'pending';
        step3Status = 'pending';
        step2Description = 'Esperando inicio del bot...';
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center">
                    <Bot className="w-4 h-4 mr-2" />
                    Estado Actual del Bot
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-0">
                    <StatusStep 
                        icon={PlayCircle}
                        title="Bot Iniciado"
                        description="El bot ha recibido la orden de empezar."
                        status={step1Status}
                    />
                     <StatusStep 
                        icon={Loader}
                        title="Calentamiento de Datos"
                        description={step2Description}
                        status={step2Status}
                        progress={step2Progress}
                    />
                     <StatusStep 
                        icon={Search}
                        title="Buscando Oportunidad"
                        description="Analizando el mercado para la próxima operación."
                        status={step3Status}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
