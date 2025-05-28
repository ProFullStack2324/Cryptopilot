
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
import type { MarketPriceDataPoint, SignalEvent, SmaCrossoverEvent } from "@/lib/types";
import { marketPriceChartConfigDark, PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types"; // Importar PRICE_HISTORY_POINTS_TO_KEEP
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useEffect, useState } from 'react';

const SMA10_PERIOD = 10;
const SMA20_PERIOD = 20;
const SMA50_PERIOD = 50;
const MAX_SMA_CROSSOVER_EVENTS_ON_CHART = 5;


interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  initialPriceHistory: MarketPriceDataPoint[];
  aiSignalEvents?: SignalEvent[];
}

const calculateSMA = (data: MarketPriceDataPoint[], period: number): (number | undefined)[] => {
  if (!data || data.length < period) {
    return Array(data.length).fill(undefined);
  }
  const smaValues: (number | undefined)[] = Array(period - 1).fill(undefined);
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.price, 0);
    smaValues.push(parseFloat((sum / period).toFixed(5)));
  }
  return smaValues;
};


export function MarketPriceChart({ marketId, marketName, initialPriceHistory, aiSignalEvents = [] }: MarketPriceChartProps) {
  const [smaCrossoverEvents, setSmaCrossoverEvents] = useState<SmaCrossoverEvent[]>([]);

  const chartDataWithSMAs = useMemo(() => {
    const sma10Values = calculateSMA(initialPriceHistory, SMA10_PERIOD);
    const sma20Values = calculateSMA(initialPriceHistory, SMA20_PERIOD);
    const sma50Values = calculateSMA(initialPriceHistory, SMA50_PERIOD);
    return initialPriceHistory.map((point, index) => ({
      ...point,
      date: format(fromUnixTime(point.timestamp), 'HH:mm:ss', { locale: es }),
      sma10: sma10Values[index],
      sma20: sma20Values[index],
      sma50: sma50Values[index],
    }));
  }, [initialPriceHistory]);

  useEffect(() => {
    if (chartDataWithSMAs.length < 2) return;

    const lastPoint = chartDataWithSMAs[chartDataWithSMAs.length - 1];
    const prevPoint = chartDataWithSMAs[chartDataWithSMAs.length - 2];

    if (lastPoint && prevPoint && typeof lastPoint.sma10 === 'number' && typeof lastPoint.sma20 === 'number' &&
        typeof prevPoint.sma10 === 'number' && typeof prevPoint.sma20 === 'number') {
      
      let newCrossoverEvent: SmaCrossoverEvent | null = null;

      if (prevPoint.sma10 < prevPoint.sma20 && lastPoint.sma10 > lastPoint.sma20) {
        newCrossoverEvent = {
          timestamp: lastPoint.timestamp,
          price: lastPoint.price,
          type: 'SMA_CROSS_BUY',
        };
      }
      else if (prevPoint.sma10 > prevPoint.sma20 && lastPoint.sma10 < lastPoint.sma20) {
         newCrossoverEvent = {
          timestamp: lastPoint.timestamp,
          price: lastPoint.price,
          type: 'SMA_CROSS_SELL',
        };
      }

      if (newCrossoverEvent) {
        setSmaCrossoverEvents(prevEvents => 
          [...prevEvents, newCrossoverEvent!].slice(-MAX_SMA_CROSSOVER_EVENTS_ON_CHART)
        );
      }
    }
  }, [chartDataWithSMAs]);


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
  const quoteAsset = marketName.split('/')[1] || 'USD'; 
  
  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <TrendingUp className="h-6 w-6 mr-2 text-primary" />
          {marketName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {marketId === "BTCUSDT" ? "Precio de BTC/USD (actualizado de CoinGecko)" : "Historial de precios (simulado, actualizándose)"}
        </CardDescription>
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
                stroke={marketPriceChartConfigDark.sma10.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma10.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma10.label as string}
                connectNulls={true} 
              />
              <Line
                yAxisId="left"
                dataKey="sma20"
                type="monotone"
                stroke={marketPriceChartConfigDark.sma20.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma20.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma20.label as string}
                connectNulls={true}
              />
              <Line
                yAxisId="left"
                dataKey="sma50"
                type="monotone"
                stroke={marketPriceChartConfigDark.sma50.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma50.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma50.label as string}
                connectNulls={true}
              />
              {aiSignalEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left"
                  key={`ai-signal-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={7} 
                  fill={event.type === 'BUY' ? marketPriceChartConfigDark.aiBuySignal.color : marketPriceChartConfigDark.aiSellSignal.color} 
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
              {smaCrossoverEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left"
                  key={`sma-cross-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={5} 
                  fill={event.type === 'SMA_CROSS_BUY' ? marketPriceChartConfigDark.smaCrossBuySignal.color : marketPriceChartConfigDark.smaCrossSellSignal.color}
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                  isFront={true}
                >
                  <RechartsTooltip
                    content={() => (
                      <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                        <p className="font-semibold">{event.type === 'SMA_CROSS_BUY' ? 'Cruce SMA: COMPRAR' : 'Cruce SMA: VENDER'}</p>
                        <p>Precio: ${event.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</p>
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
        <div className="flex gap-2 font-medium leading-none text-foreground flex-wrap"> 
          <span>Últ. precio ({marketName}): <span style={{color: marketPriceChartConfigDark.price.color}}>${lastPoint.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}.</span></span>
           {lastPoint.sma10 !== undefined && <span style={{color: marketPriceChartConfigDark.sma10.color}}>SMA10: ${lastPoint.sma10.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma20 !== undefined && <span style={{color: marketPriceChartConfigDark.sma20.color}}>SMA20: ${lastPoint.sma20.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma50 !== undefined && <span style={{color: marketPriceChartConfigDark.sma50.color}}>SMA50: ${lastPoint.sma50.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
        </div>
        <div className="leading-none text-muted-foreground">
          {marketId === "BTCUSDT" ? "Actualizado desde CoinGecko." : `Simulación: actualizando cada 1.5-3s. Mostrando últimos ${PRICE_HISTORY_POINTS_TO_KEEP} puntos.`}
        </div>
      </CardFooter>
    </Card>
  )
}
