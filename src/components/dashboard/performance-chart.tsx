
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
import type { PerformanceDataPoint } from "@/lib/types"; // Cambio a PerformanceDataPoint
import { marketPriceChartConfigDark as mockPerformanceChartConfigDark } from "@/lib/types"; // Usar config renombrada
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';


const initialPerformanceData: PerformanceDataPoint[] = [ // Esto representa el rendimiento del *portafolio total*, no un mercado específico
  { date: format(new Date(2024,6,1), 'MMM dd', {locale: es}), value: 9500 },
  { date: format(new Date(2024,6,3), 'MMM dd', {locale: es}), value: 9700 },
  { date: format(new Date(2024,6,5), 'MMM dd', {locale: es}), value: 9650 },
  { date: format(new Date(2024,6,7), 'MMM dd', {locale: es}), value: 10050 },
  { date: format(new Date(2024,6,9), 'MMM dd', {locale: es}), value: 10200 },
  { date: format(new Date(2024,6,11), 'MMM dd', {locale: es}), value: 10150 },
  { date: format(new Date(2024,6,13), 'MMM dd', {locale: es}), value: 10300 },
  { date: format(new Date(2024,6,15), 'MMM dd', {locale: es}), value: 10500 },
  { date: format(new Date(2024,6,17), 'MMM dd', {locale: es}), value: 10450 },
  { date: format(new Date(2024,6,19), 'MMM dd', {locale: es}), value: 10700 },
  { date: format(new Date(2024,6,21), 'MMM dd', {locale: es}), value: 10900 },
  { date: format(new Date(2024,6,23), 'MMM dd', {locale: es}), value: 10800 },
  { date: format(new Date(2024,6,25), 'MMM dd', {locale: es}), value: 11050 },
  { date: format(new Date(2024,6,27), 'MMM dd', {locale: es}), value: 11200 },
  { date: format(new Date(2024,6,29), 'MMM dd', {locale: es}), value: 11150 },
];


export function PerformanceChart() { // Este componente se mantiene como rendimiento general del portafolio
  const [chartData, setChartData] = useState<PerformanceDataPoint[] | null>(null);

  useEffect(() => {
    setChartData(initialPerformanceData);
  }, []);

  if (chartData === null) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Rendimiento del Portafolio</CardTitle>
          <CardDescription>Cargando datos del gráfico...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
           <div className="h-full w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }
  
  const currentPortfolioValue = chartData.length > 0 ? chartData[chartData.length -1].value : 0;

  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          Rendimiento General Portafolio
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Valor total del portafolio (simulado)</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <ChartContainer config={mockPerformanceChartConfigDark} className="h-[200px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0, 
              right: 12,
              top: 5,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 6)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${(value / 1000)}k`}
              stroke="hsl(var(--muted-foreground))"
              domain={['dataMin - 500', 'dataMax + 500']}
              fontSize={10}
            />
            <ChartTooltip
              cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3"}}
              content={<ChartTooltipContent indicator="line" labelClassName="text-foreground" className="bg-popover text-popover-foreground border-popover-foreground/50" />}
            />
            <Line
              dataKey="value" // 'value' es el key en PerformanceDataPoint
              type="monotone"
              stroke="hsl(var(--chart-2))" // Usar otro color para distinguirlo del gráfico de mercado
              strokeWidth={2}
              dot={{ r: 2, fill: "hsl(var(--chart-2))", strokeWidth: 1, stroke: "hsl(var(--background))" }}
              activeDot={{ r: 4, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-0 pb-3">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          Valor actual: ${currentPortfolioValue.toLocaleString()}.
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando datos simulados de los últimos 30 días.
        </div>
      </CardFooter>
    </Card>
  )
}

