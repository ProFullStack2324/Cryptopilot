// src/components/dashboard/binance-balances-display.tsx
"use client";

import React from 'react';
// useEffect and useState are  removed because this component now receives data via props.
// The   fetching  should be in a parent component (e.g., page.tsx).
// import { useEffect, useState } from 'react'; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Consolidate all lucide-react imports into one line to avoid duplicates
import { Loader2, AlertCircle, Wallet, DollarSign } from 'lucide-react'; 

// Import Balance and BinanceBalancesDisplayProps from types.ts
// Ensure these interfaces are correctly defined in src/lib/types.ts
import type { Balance, BinanceBalancesDisplayProps } from '@/lib/types'; 

// BalancesResponse interface and local BinanceBalancesDisplayProps declaration are removed
// because they are either imported from types.ts or the fetching logic is moved out.

// The component now accepts props: balances, isLoading, and error
export function BinanceBalancesDisplay({ balances, isLoading, error }: BinanceBalancesDisplayProps) {
  // No local state (useState) or fetching logic (useEffect) here,
  // as the data is passed down through props.

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <Wallet className="w-4 h-4 mr-2" />
          Balances de Binance
        </CardTitle>
        <CardDescription className="text-xs">
          Saldos disponibles y en órdenes de tu cuenta de Binance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Use isLoading and error directly from props */}
        {isLoading && <p className="text-sm text-muted-foreground">Cargando balances...</p>}
        {error && <p className="text-sm text-red-500">Error: {error}</p>}
        
        {/* Access 'balances' directly from props. 'balances.balances' is incorrect now. */}
        {balances && Object.keys(balances).length > 0 ? ( 
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="py-2 px-4 text-left font-medium text-muted-foreground">Activo</th>
                  <th className="py-2 px-4 text-left font-medium text-muted-foreground">Disponible</th>
                  <th className="py-2 px-4 text-left font-medium text-muted-foreground">En Órdenes</th>
                </tr>
              </thead>
              <tbody>
                {/* Iterate directly over the 'balances' prop */}
                {Object.entries(balances).map(([asset, data]) => (
                  <tr key={asset} className="border-b last:border-b-0">
                    <td className="py-2 px-4 font-semibold">{asset}</td>
                    {/* Assuming data.available and data.onOrder are numbers based on the Balance interface */}
                    <td className="py-2 px-4">{data.available.toFixed(8)}</td> 
                    <td className="py-2 px-4">{data.onOrder.toFixed(8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          // Display message when not loading, no error, and no significant balances
          !isLoading && !error && <p className="text-sm text-muted-foreground">No se encontraron balances significativos.</p>
        )}
      </CardContent>
    </Card>
  );
}