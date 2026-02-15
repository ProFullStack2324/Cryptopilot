"use client";

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
 CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartLoadingStateProps {
  marketName: string;
}

export function ChartLoadingState({ marketName }: ChartLoadingStateProps) {
  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <TrendingUp className="h-6 w-6 mr-2 text-primary" />
          Gráfico de Precio: {marketName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">Cargando datos de precios...</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow h-[calc(100%-8rem)] flex items-center justify-center">
         <div className="text-muted-foreground text-center">Cargando datos o no disponibles...</div>
      </CardContent>
    </Card>
  );
}