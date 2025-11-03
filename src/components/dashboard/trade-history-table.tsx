// src/components/dashboard/trade-history-table.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Log {
    timestamp: number;
    message: string;
    success?: boolean;
    details?: any;
}

interface TradeHistoryTableProps {
    logs: Log[];
    title: string;
    emptyLogMessage: string;
    className?: string;
}

export function TradeHistoryTable({ logs, title, emptyLogMessage, className }: TradeHistoryTableProps) {
    return (
        <Card className={cn("h-full", className)}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <ScrollArea className="h-[250px] w-full pr-4">
                    {logs.length > 0 ? logs.map(log => (
                        <div key={log.timestamp} className="text-xs border-b py-2">
                            <p className="flex items-center">
                                <span className="font-bold mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`font-semibold ${log.success === false ? 'text-destructive' : 'text-primary'}`}>
                                    {log.success === false ? '❌ ' : log.type === 'order_placed' ? '✅ ' : 'ℹ️ '}
                                    {log.message}
                                </span>
                            </p>
                            {log.details && (
                                <pre className="text-[10px] bg-muted/50 p-1 mt-1 whitespace-pre-wrap break-words rounded">
                                    {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                                </pre>
                            )}
                        </div>
                    )) : <p className="text-sm text-muted-foreground">{emptyLogMessage}</p>}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
