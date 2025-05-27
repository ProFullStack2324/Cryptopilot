
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, TrendingUp } from "lucide-react";
import { useState, useEffect } from 'react';

export function BalanceCard() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    // Simula la obtención del saldo
    // En una aplicación real, esto sería una llamada a la API
    setBalance(Math.random() * 25000 + 5000); // Saldo aleatorio entre 5k y 30k
  }, []);

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
        <Landmark className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {balance === null ? (
           <div className="h-8 w-1/2 animate-pulse rounded-md bg-muted"></div>
        ) : (
          <div className="text-3xl font-bold text-primary">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 flex items-center">
          <TrendingUp className="h-4 w-4 mr-1 text-green-500" /> +2.5% desde el mes pasado
        </p>
      </CardContent>
    </Card>
  );
}

