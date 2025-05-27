
"use client"

import { TrendingUp } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceDot, Tooltip as RechartsTooltip, Legend } from "recharts"
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
import { useState, useEffect, useRef, useMemo } from 'react';

const MAX_DATA_POINTS = 100; 
const UPDATE_INTERVAL_MS = 3000;
const SMA10_PERIOD = 10;
const SMA20_PERIOD = 20;
const SMA50_PERIOD = 50; // Nuevo período para SMA 50

interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  initialPriceHistory: MarketPriceDataPoint[];
  signalEvents?: SignalEvent[];
}

const calculateSMA = (data: MarketPriceDataPoint[], period: number): (number | undefined)[] => {
  if (!data || data.length < period) {
    return Array(data.length).fill(undefined); // Devolver undefined para todos los puntos si no hay suficientes datos
  }
  const smaValues: (number | undefined)[] = Array(period - 1).fill(undefined);
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.price, 0);
    smaValues.push(parseFloat((sum / period).toFixed(5)));
  }
  return smaValues;
};


export function MarketPriceChart({ marketId, marketName, initialPriceHistory, signalEvents = [] }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<MarketPriceDataPoint[]>(initialPriceHistory);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let processedInitialHistory = initialPriceHistory.slice(-MAX_DATA_POINTS);
    setPriceHistory(processedInitialHistory);
  }, [initialPriceHistory, marketId]);


  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setPriceHistory(prevHistory => {
        if (prevHistory.length === 0) {
          return prevHistory; 
        }
        const lastPoint = prevHistory[prevHistory.length - 1];
        if (!lastPoint || typeof lastPoint.price !== 'number') {
            return prevHistory;
        }

        let newPrice = lastPoint.price * (1 + (Math.random() - 0.495) * 0.001); 
        if (newPrice <=0) newPrice = lastPoint.price > 0 ? lastPoint.price * 0.99 : 0.00001;
        
        const newPoint: MarketPriceDataPoint = {
          timestamp: Math.floor(Date.now() / 1000), 
          price: parseFloat(newPrice.toFixed(5)),
        };
        
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
  }, [marketId]); 

  const chartDataWithSMAs = useMemo(() => {
    const sma10Values = calculateSMA(priceHistory, SMA10_PERIOD);
    const sma20Values = calculateSMA(priceHistory, SMA20_PERIOD);
    const sma50Values = calculateSMA(priceHistory, SMA50_PERIOD); // Calcular SMA 50
    return priceHistory.map((point, index) => ({
      ...point,
      date: format(fromUnixTime(point.timestamp), 'HH:mm:ss', { locale: es }),
      sma10: sma10Values[index],
      sma20: sma20Values[index],
      sma50: sma50Values[index], // Añadir SMA 50 a los datos del gráfico
    }));
  }, [priceHistory]);


  if (!chartDataWithSMAs || chartDataWithSMAs.length === 0) {
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
  
  const lastPoint = chartDataWithSMAs.length > 0 ? chartDataWithSMAs[chartDataWithSMAs.length -1] : { price: 0, sma10: undefined, sma20: undefined, sma50: undefined };
  const quoteAsset = marketId.split('USD')[1] || 'USD'; 
  
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
              data={chartDataWithSMAs}
              margin={{
                left: -10, 
                right: 20,
                top: 5,
                bottom: 20, 
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value, index) => {
                  if (chartDataWithSMAs.length > 10 && index % Math.floor(chartDataWithSMAs.length / 7) !== 0 && index !== chartDataWithSMAs.length -1 && index !== 0) return '';
                  return value; 
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left" 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}`}
                stroke="hsl(var(--muted-foreground))"
                domain={['auto', 'auto']}
                fontSize={11}
                width={85} 
              />
              <ChartTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1.5, strokeDasharray: "3 3"}}
                content={<ChartTooltipContent 
                            indicator="line" 
                            labelClassName="text-foreground text-sm" 
                            className="bg-popover text-popover-foreground border-popover-foreground/50 shadow-xl" 
                            formatter={(value, name, props) => {
                              const currency = quoteAsset;
                              const rawValue = props.payload?.[name as keyof typeof props.payload] as number | undefined;
                              
                              if (name === 'price' || name === 'sma10' || name === 'sma20' || name === 'sma50') {
                                return [
                                  rawValue?.toLocaleString(undefined, {style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5}),
                                  marketPriceChartConfigDark[name as keyof typeof marketPriceChartConfigDark]?.label || name
                                ];
                              }
                              return [value, name];
                            }}
                            labelFormatter={(label, payload) => {
                              const point = payload && payload.length > 0 && payload[0].payload as MarketPriceDataPoint & { date: string };
                              return point && point.timestamp ? format(fromUnixTime(point.timestamp), "Pp", { locale: es }) : label;
                            }}
                          />}
              />
              <Legend verticalAlign="bottom" height={30} wrapperStyle={{fontSize: "10px", textTransform: 'capitalize'}}/>
              <Line
                yAxisId="left"
                dataKey="price"
                type="monotone"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={marketPriceChartConfigDark.price.label as string}
              />
              <Line
                yAxisId="left"
                dataKey="sma10"
                type="monotone"
                stroke="hsl(var(--chart-5))"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-5))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma10.label as string}
                connectNulls={true} 
              />
              <Line
                yAxisId="left"
                dataKey="sma20"
                type="monotone"
                stroke="hsl(var(--chart-2))"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma20.label as string}
                connectNulls={true}
              />
              <Line
                yAxisId="left"
                dataKey="sma50" // Nueva línea para SMA 50
                type="monotone"
                stroke="hsl(var(--chart-4))" // Usando chart-4
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-4))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma50.label as string}
                connectNulls={true}
              />
              {signalEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left"
                  key={`signal-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={6}
                  fill={event.type === 'BUY' ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))"} 
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  isFront={true}
                >
                  <RechartsTooltip
                    content={() => (
                      <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                        <p className="font-semibold">Señal IA: {event.type === 'BUY' ? 'COMPRA' : 'VENTA'}</p>
                        <p>Precio: ${event.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</p>
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
        <div className="flex gap-2 font-medium leading-none text-foreground flex-wrap"> {/* Added flex-wrap */}
          <span>Último precio ({marketName}): ${lastPoint.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}.</span>
           {lastPoint.sma10 !== undefined && <span className="text-[var(--chart-5)]">SMA10: ${lastPoint.sma10.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma20 !== undefined && <span className="text-[var(--chart-2)]">SMA20: ${lastPoint.sma20.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma50 !== undefined && <span className="text-[var(--chart-4)]">SMA50: ${lastPoint.sma50.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
        </div>
        <div className="leading-none text-muted-foreground">
          Actualizando cada {UPDATE_INTERVAL_MS / 1000} segundos. Mostrando últimos {MAX_DATA_POINTS} puntos.
        </div>
      </CardFooter>
    </Card>
  )
}
