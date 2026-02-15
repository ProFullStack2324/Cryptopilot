// src/components/dashboard/signal-history-table.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SignalLog } from '@/hooks/useSignalHistory'; // Importar el tipo

interface SignalHistoryTableProps {
    logs: SignalLog[];
    isLoading: boolean;
    error: string | null;
    title: string;
    emptyLogMessage: string;
    className?: string;
}

export function SignalHistoryTable({ logs, isLoading, error, title, emptyLogMessage, className }: SignalHistoryTableProps) {
    
    const getConditionText = (conditions: NonNullable<SignalLog['details']>['conditions'] | undefined) => {
        if (!conditions) return "N/A";
        const met = [];
        if (conditions.price) met.push("Precio vs BB");
        if (conditions.rsi) met.push("RSI");
        if (conditions.macd) met.push("Cruce MACD");
        return met.join(' + ') || "Ninguna";
    };

    const formatCurrency = (value: number | undefined) => {
        if (typeof value !== 'number') return 'N/A';
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

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
                                <span className={`font-semibold capitalize ${log.details?.strategyMode === 'sniper' ? 'text-amber-500' : 'text-blue-400'}`}>
                                    Señal {log.details?.strategyMode || 'N/A'}
                                </span>
                                <span className="text-muted-foreground">
                                    [{new Date(log.timestamp).toLocaleTimeString()}]
                                </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4">
                                <span>Precio: {formatCurrency(log.details?.price)}</span>
                                <span>Condiciones: {getConditionText(log.details?.conditions)} ({log.details?.buyConditionsCount || 0})</span>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
