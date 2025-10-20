// src/components/dashboard/header.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BotControls } from './bot-controls';
import { Market } from '@/lib/types';

interface HeaderProps {
    selectedMarketId: string;
    onMarketChange: (marketId: string) => void;
    isBotRunning: boolean;
    toggleBotStatus: () => void;
    currentPrice: number | null;
    selectedMarket: Market | null;
    mockMarkets: Market[];
    errorMessages: {
        rules: string | null;
        balances: string | null;
        order: string | null;
    };
    loadingStatus: {
        rules: boolean;
        order: boolean;
    };
}

const parseErrorMessage = (error: string | null): string => {
    if (!error) return "Error desconocido.";
    return error;
};

export function Header({
    selectedMarketId,
    onMarketChange,
    isBotRunning,
    toggleBotStatus,
    currentPrice,
    selectedMarket,
    mockMarkets,
    errorMessages,
    loadingStatus,
}: HeaderProps) {
    return (
        <header className="w-full mb-6">
            <Card className="shadow-lg rounded-xl">
                <CardHeader>
                    <CardTitle className="text-3xl sm:text-4xl font-bold text-center">CryptoPilot Bot</CardTitle>
                    <CardDescription className="text-center text-muted-foreground">Tu panel de control para trading automatizado.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Mercado:</span>
                        <Select onValueChange={onMarketChange} value={selectedMarketId || ""}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                            <SelectContent>
                                {mockMarkets.map(market => <SelectItem key={market.id} value={market.id}>{market.symbol}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <BotControls isBotRunning={isBotRunning} onToggleBot={toggleBotStatus} />
                </CardContent>
                <CardFooter className="flex-col items-center text-xs text-muted-foreground space-y-1">
                    {selectedMarket && <p><strong>Precio Actual:</strong> {currentPrice !== null ? currentPrice.toFixed(selectedMarket.pricePrecision) : 'Cargando...'}</p>}
                    {loadingStatus.order && <p className="text-orange-500 font-semibold">Colocando orden...</p>}
                    {errorMessages.order && <p className="text-red-500 font-semibold">Error de Orden: {parseErrorMessage(errorMessages.order)}</p>}
                    {loadingStatus.rules && <p className="text-blue-500">Cargando reglas del mercado...</p>}
                    {errorMessages.rules && <p className="text-red-500">Error al cargar reglas: {parseErrorMessage(errorMessages.rules)}</p>}
                    {errorMessages.balances && <p className="text-red-500">Error al cargar balances: {parseErrorMessage(errorMessages.balances)}</p>}
                </CardFooter>
            </Card>
        </header>
    );
}
