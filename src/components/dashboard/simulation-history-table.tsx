// src/components/dashboard/simulation-history-table.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ClosedSimulation } from '@/hooks/useSimulationHistory'; // Importar el tipo
import { TrendingUp, TrendingDown, Shield, Target } from 'lucide-react';
import clsx from 'clsx';

interface SimulationHistoryTableProps {
    logs: ClosedSimulation[];
    isLoading: boolean;
    error: string | null;
    title: string;
    emptyLogMessage: string;
    className?: string;
}

const getExitReasonText = (reason: string) => {
    switch (reason) {
        case 'take_profit': return <><Target className="w-3 h-3 text-green-500 mr-1"/>Take Profit</>;
        case 'stop_loss': return <><Shield className="w-3 h-3 text-red-500 mr-1"/>Stop Loss</>;
        default: return reason;
    }
};

export function SimulationHistoryTable({ logs, isLoading, error, title, emptyLogMessage, className }: SimulationHistoryTableProps) {
    return (
        <Card className={cn("h-full", className)}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full pr-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : error ? (
                         <p className="text-sm text-destructive">{error}</p>
                    ) : logs.length > 0 ? logs.map(log => (
                        <div key={log._id} className="text-xs border-b py-2 space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="font-bold mr-2">[{new Date(log.startedAt).toLocaleTimeString()}]</span>
                                <span className={`font-semibold capitalize text-blue-400`}>{log.strategy}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex justify-between">
                                <span>Entrada: ${log.entryPrice.toFixed(2)}</span>
                                <span>Salida: ${log.exitPrice.toFixed(2)}</span>
                            </div>
                             <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center">{getExitReasonText(log.exitReason)}</span>
                                <span className={clsx("font-bold flex items-center", log.finalPnl >= 0 ? "text-green-500" : "text-red-500")}>
                                    {log.finalPnl >= 0 ? <TrendingUp className="w-3 h-3 mr-1"/> : <TrendingDown className="w-3 h-3 mr-1"/>}
                                    PnL: ${log.finalPnl.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
