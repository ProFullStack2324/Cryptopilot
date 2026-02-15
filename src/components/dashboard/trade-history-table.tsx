// src/components/dashboard/trade-history-table.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, AlertCircle, Info } from "lucide-react";
import clsx from 'clsx';
import { TradeLog } from '@/hooks/useTradeHistory'; // Importar el tipo

interface TradeHistoryTableProps {
    logs: TradeLog[];
    isLoading: boolean;
    error: string | null;
    title: string;
    emptyLogMessage: string;
    className?: string;
}

export function TradeHistoryTable({ logs, isLoading, error, title, emptyLogMessage, className }: TradeHistoryTableProps) {
    
    const formatCurrency = (value: number | undefined) => {
        if (typeof value !== 'number') return '$0.00';
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getIconAndColor = (log: TradeLog) => {
        if (!log.details) return { Icon: Info, color: "text-muted-foreground" };
        if (!log.success) return { Icon: AlertCircle, color: "text-destructive" };
        if (log.details.side === 'buy') return { Icon: ArrowUpRight, color: "text-green-500" };
        if (log.details.side === 'sell') return { Icon: ArrowDownLeft, color: "text-red-500" };
        return { Icon: Info, color: "text-blue-500" };
    };

    return (
        <Card className={cn("h-full", className)}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full pr-4">
                    {isLoading ? (
                         <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : error ? (
                        <p className="text-sm text-destructive">{error}</p>
                    ) : logs.length > 0 ? logs.map(log => {
                        const { Icon, color } = getIconAndColor(log);
                        const details = log.details;
                        
                        // Si no hay detalles, es un log informativo
                        if (!details) {
                            return (
                                <div key={log._id || log.timestamp} className="text-xs border-b py-2 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Icon className={cn("w-4 h-4", color)} />
                                            <span className={clsx("font-semibold", color)}>
                                                {log.message}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground">
                                            [{new Date(log.timestamp).toLocaleTimeString()}]
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        const value = details.cummulativeQuoteQty ? parseFloat(details.cummulativeQuoteQty) : (details.price || 0) * (details.origQty || 0);

                        return (
                            <div key={log._id || log.timestamp} className="text-xs border-b py-2 space-y-1">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Icon className={cn("w-4 h-4", color)} />
                                        <span className={clsx("font-semibold capitalize", color)}>
                                            {details.side || 'Info'}
                                        </span>
                                        <span className="font-bold">{details.symbol}</span>
                                    </div>
                                    <span className="text-muted-foreground">
                                        [{new Date(log.timestamp).toLocaleTimeString()}]
                                    </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-4 pl-6">
                                    <span>Cant: {details.origQty?.toFixed(6) || 'N/A'}</span>
                                    <span className="text-right">Valor: {formatCurrency(value)}</span>
                                </div>
                                {!log.success && <p className="text-destructive text-[10px] pl-6">{log.message}</p>}
                            </div>
                        );
                    }) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
