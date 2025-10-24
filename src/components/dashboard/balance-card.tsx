"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet } from "lucide-react";
import { BinanceBalance } from "@/lib/types";

interface BalanceCardProps {
    balances: BinanceBalance[];
    isLoading: boolean;
    error: string | null;
}

const parseErrorMessage = (error: string | null): string => {
    if (!error) return "Error desconocido.";
    return error;
};

export function BalanceCard({ balances, isLoading, error }: BalanceCardProps) {
    return (
        <Card className="shadow-lg rounded-xl">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Wallet className="w-5 h-5 mr-2" />
                    Balances de Binance
                </CardTitle>
                <CardDescription>Saldos disponibles y en órdenes.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && <p>Cargando balances...</p>}
                {error && <p className="text-red-500">{parseErrorMessage(error)}</p>}
                {balances.length > 0 ? (
                    <ScrollArea className="h-[150px]">
                        <ul>
                            {balances.map(bal => (
                                <li key={bal.asset}><strong>{bal.asset}:</strong> {(bal.free + bal.locked).toFixed(4)}</li>
                            ))}
                        </ul>
                    </ScrollArea>
                ) : (!isLoading && !error && <p>No se encontraron balances significativos.</p>)}
            </CardContent>
        </Card>
    );
}
