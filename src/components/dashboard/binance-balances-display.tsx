// src/components/dashboard/binance-balances-display.tsx
"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define las interfaces para los datos que esperamos de la API de balances
interface Balance {
  available: string;
  onOrder: string;
}

interface BalancesResponse {
  message: string;
  balances: Record<string, Balance>;
}

export function BinanceBalancesDisplay() {
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const response = await fetch('/api/binance/balance');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error HTTP ${response.status}: ${errorData.message || 'Error desconocido'}`);
        }
        const data: BalancesResponse = await response.json();
        setBalances(data);
      } catch (err: any) {
        console.error("[BinanceBalancesDisplay] Error al cargar balances:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
  }, []);

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
        {loading && <p className="text-sm text-muted-foreground">Cargando balances...</p>}
        {error && <p className="text-sm text-red-500">Error: {error}</p>}
        {balances && Object.keys(balances.balances).length > 0 ? (
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
                {Object.entries(balances.balances).map(([asset, data]) => (
                  <tr key={asset} className="border-b last:border-b-0">
                    <td className="py-2 px-4 font-semibold">{asset}</td>
                    <td className="py-2 px-4">{parseFloat(data.available).toFixed(8)}</td>
                    <td className="py-2 px-4">{parseFloat(data.onOrder).toFixed(8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          !loading && !error && <p className="text-sm text-muted-foreground">No se encontraron balances significativos.</p>
        )}
      </CardContent>
    </Card>
  );
}