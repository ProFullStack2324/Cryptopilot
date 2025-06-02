// src/components/dashboard/balance-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

// Importa la interfaz de props desde types.ts si la tienes allí,
// o defínela aquí si este componente es el único que la usa.
import { BalanceCardProps } from "@/lib/types"; // Asumiendo que la importas de types.ts

export function BalanceCard({ balance, asset = "USD", isLoading = false, description, title = "Saldo" }: BalanceCardProps) {
  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title} ({asset})</CardTitle>
        <Wallet className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading ? (
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted my-1"></div>
        ) : balance === null ? (
            <div className="text-3xl font-bold text-foreground">-</div>
        ) : (
          <div className="text-3xl font-bold text-foreground">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {description || `Tu saldo disponible en ${asset}.`}
        </p>
      </CardContent>
    </Card>
  );
}