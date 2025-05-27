
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
import type { PerformanceDataPoint } from "@/lib/types";
import { mockPerformanceChartConfigDark } from "@/lib/types"; // Using dark theme config
import { useState, useEffect } from 'react';

const initialPerformanceData: PerformanceDataPoint[] = [
  { date: 'Jul 01', value: 9500 },
  { date: 'Jul 03', value: 9700 },
  { date: 'Jul 05', value: 9650 },
  { date: 'Jul 07', value: 10050 },
  { date: 'Jul 09', value: 10200 },
  { date: 'Jul 11', value: 10150 },
  { date: 'Jul 13', value: 10300 },
  { date: 'Jul 15', value: 10500 },
  { date: 'Jul 17', value: 10450 },
  { date: 'Jul 19', value: 10700 },
  { date: 'Jul 21', value: 10900 },
  { date: 'Jul 23', value: 10800 },
  { date: 'Jul 25', value: 11050 },
  { date: 'Jul 27', value: 11200 },
  { date: 'Jul 29', value: 11150 },
];


export function PerformanceChart() {
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
  
  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          Rendimiento del Portafolio
        </CardTitle>
        <CardDescription className="text-muted-foreground">Valor del portafolio en los últimos 30 días</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={mockPerformanceChartConfigDark} className="h-[300px] w-full">
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
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${(value / 1000)}k`}
              stroke="hsl(var(--muted-foreground))"
              domain={['dataMin - 500', 'dataMax + 500']}
            />
            <ChartTooltip
              cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3"}}
              content={<ChartTooltipContent indicator="line" labelClassName="text-foreground" className="bg-popover text-popover-foreground border-popover-foreground/50" />}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--chart-1))", strokeWidth: 1, stroke: "hsl(var(--background))" }}
              activeDot={{ r: 5, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          El valor actual del portafolio es ${chartData[chartData.length -1].value.toLocaleString()}.
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando datos de los últimos 30 días.
        </div>
      </CardFooter>
    </Card>
  )
}
