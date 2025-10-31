// src/components/dashboard/signal-history-table.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SignalLog {
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
        }
    };
}

interface SignalHistoryTableProps {
    logs: SignalLog[];
    title: string;
    emptyLogMessage: string;
    className?: string;
}

export function SignalHistoryTable({ logs, title, emptyLogMessage, className }: SignalHistoryTableProps) {
    
    const getConditionText = (conditions: SignalLog['details']['conditions']) => {
        const met = [];
        if (conditions.price) met.push("Precio vs BB");
        if (conditions.rsi) met.push("RSI");
        if (conditions.macd) met.push("Cruce MACD");
        return met.join(' + ');
    };

    return (
        <Card className={cn("h-full", className)}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full pr-4">
                    {logs.length > 0 ? logs.map(log => (
                        <div key={log.timestamp} className="text-xs border-b py-2">
                            <p>
                                <span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`font-semibold ${log.details?.strategyMode === 'sniper' ? 'text-amber-500' : 'text-blue-400'}`}>{log.message}</span>
                            </p>
                            {log.details && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Condiciones: {getConditionText(log.details.conditions)}
                                </p>
                            )}
                        </div>
                    )) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
