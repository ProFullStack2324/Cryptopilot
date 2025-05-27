
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Wallet } from "lucide-react";

interface BalanceCardProps {
  balance: number | null;
  asset?: string;
}

export function BalanceCard({ balance, asset = "USD" }: BalanceCardProps) {
  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">Saldo ({asset})</CardTitle>
        <Wallet className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="pb-4">
        {balance === null ? (
           <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted my-1"></div>
        ) : (
          <div className="text-3xl font-bold text-foreground">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Este es un saldo simulado.
        </p>
      </CardContent>
    </Card>
  );
}
