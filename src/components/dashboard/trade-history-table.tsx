// src/components/dashboard/trade-history-table.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import clsx from 'clsx';

interface Log {
    timestamp: number;
    message: string;
    success?: boolean;
    details?: any;
    type: string;
}

interface TradeHistoryTableProps {
    logs: Log[];
    title: string;
    emptyLogMessage: string;
    className?: string;
}

export function TradeHistoryTable({ logs, title, emptyLogMessage, className }: TradeHistoryTableProps) {
    const getIcon = (log: Log) => {
        if (log.type === 'order_failed' || log.success === false) {
            return <AlertTriangle className="w-4 h-4 text-destructive" />;
        }
        if (log.type === 'order_placed' && log.success === true) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
        return <Info className="w-4 h-4 text-muted-foreground" />;
    };
    
    return (
        <Card className={cn("h-full", className)}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full pr-4">
                    {logs.length > 0 ? logs.map((log, index) => (
                        <div key={`${log.timestamp}-${index}`} className="text-xs border-b py-2 space-y-1">
                            <div className="flex items-center gap-2">
                                {getIcon(log)}
                                <p>
                                    <span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                    <span className={clsx('font-semibold', {
                                        'text-destructive': log.success === false,
                                        'text-green-600 dark:text-green-400': log.type === 'order_placed' && log.success === true,
                                        'text-foreground': log.success !== false && log.type !== 'order_placed',
                                    })}>
                                        {log.message}
                                    </span>
                                </p>
                            </div>
                            {log.details && (typeof log.details === 'object' && Object.keys(log.details).length > 0) && (
                                <pre className="text-[10px] bg-muted/50 p-2 ml-6 rounded-md whitespace-pre-wrap break-words text-muted-foreground">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            )}
                        </div>
                    )) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}