// src/components/dashboard/performance-chart.tsx
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

// **ESTA ES LA LÍNEA DE IMPORTACIÓN A CAMBIAR:**
// Antes: import { marketPriceChartConfigDark as mockPerformanceChartConfigDark } from "@/lib/types";
// Ahora:
import { mockPerformanceChartConfigDark } from "@/lib/types"; // Importa directamente el nombre que ya tiene 'value'


import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ... el resto de tu código del componente PerformanceChart

// Y la línea 164 (o similar) en tu <Line />
// name={mockPerformanceChartConfigDark?.value?.label || "Valor Portafolio"}
// Debería funcionar ahora sin el error. Si el error persiste, usa la siguiente opción para la línea.
const MAX_PERFORMANCE_DATA_POINTS = 100;

interface PerformanceChartProps {
  portfolioValue: number | null;
}

export function PerformanceChart({ portfolioValue }: PerformanceChartProps) {
  const [chartData, setChartData] = useState<PerformanceDataPoint[]>([]);

  // Efecto para añadir nuevos puntos al gráfico cuando cambia el valor del portafolio
  useEffect(() => {
    if (portfolioValue !== null) {
      const newPoint: PerformanceDataPoint = {
        // Usar formato de hora para reflejar cambios más frecuentes
        date: format(new Date(), 'HH:mm:ss', { locale: es }),
        value: portfolioValue,
      };
      setChartData(prevData => {
        const updatedData = [...prevData, newPoint];
        // Limitar la cantidad de puntos de datos para mantener el rendimiento
        if (updatedData.length > MAX_PERFORMANCE_DATA_POINTS) {
          return updatedData.slice(updatedData.length - MAX_PERFORMANCE_DATA_POINTS);
        }
        return updatedData;
      });
    }
  }, [portfolioValue]);

  // Efecto para establecer un punto inicial si el portafolio tiene valor al montar
  useEffect(() => {
    if (portfolioValue !== null && chartData.length === 0) {
      setChartData([{
        date: format(new Date(), 'HH:mm:ss', { locale: es }),
        value: portfolioValue
      }]);
    }
  // No hay necesidad de suprimir el linting si portfolioValue es la única dependencia intencional
  }, [portfolioValue, chartData.length]); // Añadir chartData.length a las dependencias para evitar warnings de linting

  // Memoizar el valor actual a mostrar en el footer para evitar recálculos innecesarios
  const currentDisplayValue = useMemo(() => {
    if (chartData.length > 0) {
      return chartData[chartData.length - 1].value;
    }
    return portfolioValue; // Fallback al valor actual si el gráfico aún no tiene puntos
  }, [chartData, portfolioValue]);

  // Renderizar estado de carga si no hay valor de portafolio ni datos en el gráfico
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

  // Renderizar el gráfico cuando hay datos
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
          <ChartContainer config={mockPerformanceChartConfigDark} className="h-[180px] w-full">
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
                // Lógica para mostrar menos ticks si hay muchos puntos
                tickFormatter={(value, index) => {
                    // Muestra el primer, último y algunos ticks intermedios para claridad
                    const totalPoints = chartData.length;
                    if (totalPoints <= 10) return value; // Muestra todos si son pocos
                    if (index === 0 || index === totalPoints - 1) return value; // Siempre muestra el primero y el último
                    // Muestra ticks cada ~20% de los datos
                    if (index % Math.floor(totalPoints / 5) === 0) return value;
                    return ''; // Oculta otros ticks
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} // Formato a '$X.Xk'
                stroke="hsl(var(--muted-foreground))"
                domain={['dataMin - dataMin*0.05', 'dataMax + dataMax*0.05']} // Margen dinámico para el eje Y
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
                name={mockPerformanceChartConfigDark?.value?.label || "Valor Portafolio"}
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
  );
}