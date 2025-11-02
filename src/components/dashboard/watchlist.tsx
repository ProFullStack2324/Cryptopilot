// src/components/dashboard/watchlist.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye } from 'lucide-react';
import clsx from 'clsx';
import { Skeleton } from '@/components/ui/skeleton';

interface WatchlistItem {
    symbol: string;
    price: number | null;
    change24h: number | null; // Cambio porcentual en 24h
}

export function Watchlist() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Símbolos de interés
    const symbolsToWatch = useMemo(() => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'], []);

    useEffect(() => {
        const fetchWatchlistData = async () => {
            setIsLoading(true);
            try {
                // 1. Obtener precios actuales para los símbolos de la watchlist
                const priceResponse = await fetch(`/api/binance/ticker?symbol=${symbolsToWatch.join(',')}`);
                if (!priceResponse.ok) throw new Error('No se pudieron obtener los precios de los tickers.');
                const priceData = await priceResponse.json();

                // 2. Obtener datos de klines de 24h para calcular el cambio
                const changePromises = symbolsToWatch.map(symbol => 
                    fetch(`/api/binance/klines?symbol=${symbol}&interval=1d&limit=2`).then(res => res.json())
                );
                const klinesResults = await Promise.all(changePromises);
                
                const newWatchlist = symbolsToWatch.map((symbol, index) => {
                    const price = parseFloat(priceData.data?.[`${symbol.replace('/', '')}`]) || null;
                    const klines = klinesResults[index]?.klines;
                    let change24h = null;

                    // Calcular el cambio de 24h si tenemos datos
                    if (klines && klines.length >= 2) {
                        const openPrice = klines[0][1]; // Precio de apertura de la vela de ayer
                        const currentPrice = price || klines[1][4]; // Usar precio del ticker si está disponible, si no el de cierre de la vela actual
                        if (openPrice > 0) {
                            change24h = ((currentPrice - openPrice) / openPrice) * 100;
                        }
                    }

                    return { symbol, price, change24h };
                });

                setWatchlist(newWatchlist);
                setError(null);
            } catch (err: any) {
                setError(err.message || "Error al cargar la watchlist.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchWatchlistData();
        const interval = setInterval(fetchWatchlistData, 60000); // Actualizar cada minuto

        return () => clearInterval(interval);
    }, [symbolsToWatch]);

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center text-base">
                    <Eye className="w-4 h-4 mr-2"/>
                    Watchlist de Mercados
                </CardTitle>
                <CardDescription className="text-xs">
                    Precios en tiempo real de los principales pares USDT.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[450px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Símbolo</TableHead>
                                <TableHead className="text-right">Precio</TableHead>
                                <TableHead className="text-right">Cambio 24h</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : error ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-destructive">{error}</TableCell>
                                </TableRow>
                            ) : (
                                watchlist.map(item => (
                                    <TableRow key={item.symbol}>
                                        <TableCell className="font-medium">{item.symbol.replace('USDT', '')}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.price ? `$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </TableCell>
                                        <TableCell className={clsx('text-right font-semibold', {
                                            'text-green-500': (item.change24h || 0) >= 0,
                                            'text-red-500': (item.change24h || 0) < 0,
                                        })}>
                                            {item.change24h !== null ? `${item.change24h.toFixed(2)}%` : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
