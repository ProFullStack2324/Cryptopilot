
"use client"

import { TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceDot, Tooltip as RechartsTooltip } from "recharts"
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
import type { MarketPriceDataPoint, SignalEvent } from "@/lib/types";
import { marketPriceChartConfigDark } from "@/lib/types";
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useRef } from 'react';

const MAX_DATA_POINTS = 100; // Limitar el número de puntos en el gráfico
const UPDATE_INTERVAL_MS = 3000; // Cada 3 segundos

interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  initialPriceHistory: MarketPriceDataPoint[];
  signalEvents?: SignalEvent[];
}

export function MarketPriceChart({ marketId, marketName, initialPriceHistory, signalEvents = [] }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<MarketPriceDataPoint[]>(initialPriceHistory);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPriceHistory(initialPriceHistory.slice(-MAX_DATA_POINTS)); // Asegurarse de que empezamos con el límite
  }, [initialPriceHistory, marketId]); // Re-inicializar el historial si el mercado o el historial inicial cambian


  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setPriceHistory(prevHistory => {
        if (prevHistory.length === 0) {
          // Si no hay historial, no podemos generar un nuevo punto razonable
          // Podríamos iniciar con un precio base si es necesario
          return [];
        }
        const lastPoint = prevHistory[prevHistory.length - 1];
        const newPrice = lastPoint.price * (1 + (Math.random() - 0.495) * 0.005); // Pequeña variación aleatoria
        const newPoint: MarketPriceDataPoint = {
          timestamp: Math.floor(Date.now() / 1000), // Unix timestamp en segundos
          price: newPrice,
        };
        
        // Mantener el número máximo de puntos
        const updatedHistory = [...prevHistory, newPoint];
        if (updatedHistory.length > MAX_DATA_POINTS) {
          return updatedHistory.slice(updatedHistory.length - MAX_DATA_POINTS);
        }
        return updatedHistory;
      });
    }, UPDATE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [marketId]); // Reiniciar el intervalo si el marketId cambia para evitar múltiples intervalos o datos incorrectos

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Gráfico de Precio: {marketName}
          </CardTitle>
          <CardDescription className="text-muted-foreground">Cargando datos de precios...</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-8rem)] flex items-center justify-center">
           <div className="text-muted-foreground">Cargando datos o no disponibles...</div>
        </CardContent>
      </Card>
    );
  }
  
  const chartData = priceHistory.map(point => ({
    date: format(fromUnixTime(point.timestamp), 'MMM dd, HH:mm:ss', { locale: es }), // Formato con segundos
    price: point.price,
    timestamp: point.timestamp, // Mantener el timestamp original para los ReferenceDot
  }));

  const lastPrice = chartData.length > 0 ? chartData[chartData.length -1].price : 0;
  
  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <TrendingUp className="h-6 w-6 mr-2 text-primary" />
          {marketName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">Historial de precios (simulado, actualizándose)</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-2">
        <ChartContainer config={marketPriceChartConfigDark} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: -10, 
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
                  if (chartData.length > 10 && index % Math.floor(chartData.length / 5) !== 0 && index !== chartData.length -1 && index !== 0) return '';
                  return value.split(',')[1]?.trim().slice(0,5) || value.split(',')[0]; // HH:mm o MMM dd
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketId.includes('BTC') || marketId.includes('ETH') ? 2 : 5})}`}
                stroke="hsl(var(--muted-foreground))"
                domain={['auto', 'auto']}
                fontSize={12}
                width={90} 
              />
              <ChartTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1.5, strokeDasharray: "3 3"}}
                content={<ChartTooltipContent 
                            indicator="line" 
                            labelClassName="text-foreground text-sm" 
                            className="bg-popover text-popover-foreground border-popover-foreground/50 shadow-xl" 
                            formatter={(value, name, props) => {
                              const currency = marketId.startsWith('BTC') || marketId.startsWith('ETH') ? 'USD' : (marketId.split('/')[1] || 'USD');
                              return [
                                `${(props.payload?.price as number)?.toLocaleString(undefined, {style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: marketId.includes('BTC') || marketId.includes('ETH') ? 2 : 5})}`,
                                "Precio"
                              ];
                            }}
                            labelFormatter={(label) => {
                              const point = chartData.find(p => p.date === label);
                              return point ? format(fromUnixTime(point.timestamp), "Pp", { locale: es }) : label;
                            }}
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
              {signalEvents.map((event, index) => (
                <ReferenceDot
                  key={`signal-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'MMM dd, HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={6}
                  fill={event.type === 'BUY' ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))"} // Verde para BUY, Rojo para SELL
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  isFront={true}
                >
                  <RechartsTooltip
                    content={() => (
                      <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border">
                        <p>Señal IA: {event.type}</p>
                        <p>Precio: ${event.price.toFixed(2)}</p>
                        <p>Confianza: {(event.confidence * 100).toFixed(0)}%</p>
                        <p>Hora: {format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}</p>
                      </div>
                    )}
                    cursor={false}
                    wrapperStyle={{ zIndex: 1000 }}
                  />
                </ReferenceDot>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-1 pb-3">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          Último precio (simulado): ${lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketId.includes('BTC') || marketId.includes('ETH') ? 2 : 5})}.
        </div>
        <div className="leading-none text-muted-foreground">
          Actualizando cada {UPDATE_INTERVAL_MS / 1000} segundos. Mostrando últimos {MAX_DATA_POINTS} puntos.
        </div>
      </CardFooter>
    </Card>
  )
}
