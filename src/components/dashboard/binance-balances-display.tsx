// src/components/dashboard/binance-balances-display.tsx
"use client";

// No necesitamos useEffect ni useState aquí si useBinanceBalances ya maneja el fetch y estado.
// import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import useBinanceBalances from "@/hooks/useBinanceBalances"; // Importamos el hook

// La interfaz Balance la tomaremos de lo que devuelve el hook useBinanceBalances,
// que a su vez la obtiene de la API.
// No necesitamos definirla aquí de nuevo si el hook ya la proporciona correctamente.
// interface Balance {
//   available: string; // El hook devuelve number, no string, lo cual es mejor
//   onOrder: string;
//   total: number; // El hook sí devuelve total
// }

// Ya no es BalancesResponse, sino directamente el tipo de 'balances' del hook.
// type BalancesData = Record<string, { available: number; onOrder: number; total: number; }>;

interface BinanceBalancesDisplayProps {
  useTestnet: boolean; // Prop para indicar qué red usar
}

export function BinanceBalancesDisplay({ useTestnet }: BinanceBalancesDisplayProps) {
  // Usamos el hook useBinanceBalances para obtener los datos
  const { 
    balances, // Este será de tipo Record<string, { available: number; onOrder: number; total: number; }> | null
    isLoadingBalances, 
    balancesError,
    fetchBalances // Podemos llamar a fetchBalances si queremos un botón de refresco manual
  } = useBinanceBalances({ 
    initialFetch: true, // Cargar al montar
    fetchIntervalMs: 60000, // Refrescar cada minuto
    useTestnet: useTestnet // Pasar la prop useTestnet al hook
  });

  const networkName = useTestnet ? "Testnet" : "Mainnet";

  return (
    <Card className="mt-4"> {/* Añadido margen superior para separar de PerformanceChart */}
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base flex items-center">
          <Wallet className="w-4 h-4 mr-2" />
          Balances de Binance ({networkName})
        </CardTitle>
        <CardDescription className="text-xs">
          Saldos disponibles y en órdenes de tu cuenta de Binance {networkName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 pb-3"> {/* Ajuste de padding */}
        {isLoadingBalances && <p className="text-sm text-muted-foreground">Cargando balances de {networkName}...</p>}
        {balancesError && <p className="text-sm text-red-500">Error al cargar balances de {networkName}: {balancesError}</p>}
        {balances && Object.keys(balances).length > 0 ? (
          <ScrollArea className="h-[180px] w-full rounded-md border p-3"> {/* Ajuste de padding y altura */}
            <table className="w-full text-xs"> {/* Texto más pequeño */}
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-muted-foreground">Activo</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-muted-foreground">Disponible</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-muted-foreground">En Orden</th>
                  <th className="py-1.5 px-2 text-right font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(balances)
                  // Filtrar para mostrar solo activos con algún balance total > 0 o si están en orden
                  .filter(([_, data]) => data.total > 0 || data.onOrder > 0)
                  // Ordenar por el valor total estimado (si tuviéramos precios) o alfabéticamente
                  .sort(([assetA], [assetB]) => assetA.localeCompare(assetB))
                  .map(([asset, data]) => (
                  <tr key={asset} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="py-1.5 px-2 font-medium text-foreground">{asset}</td>
                    {/* Usar toLocaleString para formatear números, asegurando que sean números */}
                    <td className="py-1.5 px-2 text-right text-foreground/90">{Number(data.available).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:8})}</td>
                    <td className="py-1.5 px-2 text-right text-foreground/90">{Number(data.onOrder).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:8})}</td>
                    <td className="py-1.5 px-2 text-right font-semibold text-foreground">{Number(data.total).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:8})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          !isLoadingBalances && !balancesError && <p className="text-sm text-muted-foreground">No se encontraron balances significativos en {networkName}.</p>
        )}
        {/* Opcional: Botón para refrescar manualmente */}
        {/* 
        <Button onClick={() => fetchBalances()} disabled={isLoadingBalances} size="sm" variant="outline" className="mt-2">
          {isLoadingBalances ? "Refrescando..." : "Refrescar Balances"}
        </Button>
        */}
      </CardContent>
    </Card>
  );
}

