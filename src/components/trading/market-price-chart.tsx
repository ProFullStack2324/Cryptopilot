
"use client"

import { TrendingUp } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { MarketPriceDataPoint } from "@/lib/types";
import { marketPriceChartConfigDark } from "@/lib/types";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';


interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  priceHistory: MarketPriceDataPoint[];
}

export function MarketPriceChart({ marketId, marketName, priceHistory }: MarketPriceChartProps) {

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Gráfico de Precio: {marketName}
          </CardTitle>
          <CardDescription className="text-muted-foreground">No hay datos de precios disponibles para este mercado.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-8rem)] flex items-center justify-center">
           <div className="text-muted-foreground">Cargando datos o no disponibles...</div>
        </CardContent>
      </Card>
    );
  }
  
  const chartData = priceHistory.map(point => ({
    date: format(new Date(point.timestamp), 'MMM dd, HH:mm', { locale: es }), // Formato de fecha localizado
    price: point.price,
  }));

  const lastPrice = chartData.length > 0 ? chartData[chartData.length -1].price : 0;
  
  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <TrendingUp className="h-6 w-6 mr-2 text-primary" />
          {marketName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">Historial de precios (simulado)</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-2">
        <ChartContainer config={marketPriceChartConfigDark} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: -10, // Ajustar para que las etiquetas de YAxis sean visibles
                right: 20,
                top: 5,
                bottom: 5,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value, index) => {
                   // Mostrar menos ticks para claridad
                  if (chartData.length > 10 && index % Math.floor(chartData.length / 5) !== 0 && index !== chartData.length -1) return '';
                  return value.split(',')[0]; // Solo 'MMM dd'
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                stroke="hsl(var(--muted-foreground))"
                domain={['auto', 'auto']}
                fontSize={12}
                width={80} // Dar más espacio para los números
              />
              <ChartTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1.5, strokeDasharray: "3 3"}}
                content={<ChartTooltipContent 
                            indicator="line" 
                            labelClassName="text-foreground text-sm" 
                            className="bg-popover text-popover-foreground border-popover-foreground/50 shadow-xl" 
                            formatter={(value, name, props) => {
                              return [
                                `${(props.payload?.price as number)?.toLocaleString(undefined, {style: 'currency', currency: 'USD'})}`,
                                "Precio"
                              ];
                            }}
                            labelFormatter={(label) => format(new Date(priceHistory.find(p => format(new Date(p.timestamp), 'MMM dd, HH:mm', { locale: es }) === label)?.timestamp || Date.now()), "Pp", { locale: es })}
                          />}
              />
              <Line
                dataKey="price"
                type="monotone"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-1 pb-3">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          Último precio (simulado): ${lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}.
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando datos simulados.
        </div>
      </CardFooter>
    </Card>
  )
}
