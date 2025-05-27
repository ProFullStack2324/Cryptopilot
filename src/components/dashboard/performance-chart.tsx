
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
import { marketPriceChartConfigDark as mockPerformanceChartConfigDark } from "@/lib/types";
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MAX_PERFORMANCE_DATA_POINTS = 100;

interface PerformanceChartProps {
  portfolioValue: number | null;
}

export function PerformanceChart({ portfolioValue }: PerformanceChartProps) {
  const [chartData, setChartData] = useState<PerformanceDataPoint[]>([]);

  useEffect(() => {
    if (portfolioValue !== null) {
      const newPoint: PerformanceDataPoint = {
        // Usar un formato de hora para reflejar cambios más frecuentes
        date: format(new Date(), 'HH:mm:ss', { locale: es }),
        value: portfolioValue,
      };
      setChartData(prevData => {
        const updatedData = [...prevData, newPoint];
        if (updatedData.length > MAX_PERFORMANCE_DATA_POINTS) {
          return updatedData.slice(updatedData.length - MAX_PERFORMANCE_DATA_POINTS);
        }
        return updatedData;
      });
    }
  }, [portfolioValue]);

  // Establecer un punto inicial si el portafolio tiene valor al montar y el gráfico está vacío
  useEffect(() => {
    if (portfolioValue !== null && chartData.length === 0) {
       setChartData([{
         date: format(new Date(), 'HH:mm:ss', { locale: es }),
         value: portfolioValue
       }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioValue]); // Solo al montar si portfolioValue está disponible

  const currentDisplayValue = useMemo(() => {
    if (chartData.length > 0) {
      return chartData[chartData.length - 1].value;
    }
    return portfolioValue; // Fallback al valor actual si el gráfico aún no tiene puntos
  }, [chartData, portfolioValue]);

  if (portfolioValue === null && chartData.length === 0) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground mt-4">
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Rendimiento General Portafolio
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Cargando datos del portafolio...</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
           <div className="h-full w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg bg-card text-card-foreground mt-4">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center text-base">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          Rendimiento General Portafolio
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Valor total del portafolio (simulado, actualizándose)</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        {chartData.length > 0 ? (
          <ChartContainer config={mockPerformanceChartConfigDark} className="h-[180px] w-full"> {/* Reducir altura un poco */}
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
                // Mostrar menos ticks si hay muchos puntos
                tickFormatter={(value, index) => {
                    if (chartData.length > 10 && index % Math.floor(chartData.length / 5) !== 0 && index !== chartData.length -1 && index !== 0) return '';
                    return value;
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} // Ajustar formato si es necesario
                stroke="hsl(var(--muted-foreground))"
                domain={['dataMin - dataMin*0.05', 'dataMax + dataMax*0.05']} // Margen dinámico
                fontSize={10}
                width={50}
              />
              <ChartTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3"}}
                content={<ChartTooltipContent
                            indicator="line"
                            labelClassName="text-foreground"
                            className="bg-popover text-popover-foreground border-popover-foreground/50"
                            formatter={(value, name, props) => {
                                const rawValue = props.payload?.[name as keyof typeof props.payload] as number | undefined;
                                return [
                                    rawValue?.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits:2, maximumFractionDigits:2 }),
                                    mockPerformanceChartConfigDark[name as keyof typeof mockPerformanceChartConfigDark]?.label || name
                                ];
                            }}
                          />}
              />
              <Line
                dataKey="value"
                type="monotone"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 1, fill: "hsl(var(--chart-2))", strokeWidth: 0.5, stroke: "hsl(var(--background))" }}
                activeDot={{ r: 3, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={mockPerformanceChartConfigDark.value.label as string}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
            Esperando datos del portafolio...
          </div>
        )}
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-0 pb-3">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          Valor actual del portafolio: ${currentDisplayValue?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) || 'N/A'}.
        </div>
        <div className="leading-none text-muted-foreground">
          Mostrando el rendimiento simulado.
        </div>
      </CardFooter>
    </Card>
  )
}
