
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
import type { MarketPriceDataPoint, SignalEvent, SmaCrossoverEvent } from "@/lib/types"; // Importado SmaCrossoverEvent
import { marketPriceChartConfigDark } from "@/lib/types";
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useRef, useMemo } from 'react';

const MAX_DATA_POINTS = 100; 
const UPDATE_INTERVAL_MS = 3000; // 3 segundos
const SMA10_PERIOD = 10;
const SMA20_PERIOD = 20;
const SMA50_PERIOD = 50;
const MAX_SMA_CROSSOVER_EVENTS_ON_CHART = 5;


interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  initialPriceHistory: MarketPriceDataPoint[];
  aiSignalEvents?: SignalEvent[]; // Renombrado para claridad
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
  const [priceHistory, setPriceHistory] = useState<MarketPriceDataPoint[]>(initialPriceHistory);
  const [smaCrossoverEvents, setSmaCrossoverEvents] = useState<SmaCrossoverEvent[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Usar solo los últimos MAX_DATA_POINTS del historial inicial
    let processedInitialHistory = initialPriceHistory.slice(-MAX_DATA_POINTS);
    setPriceHistory(processedInitialHistory);
    setSmaCrossoverEvents([]); // Limpiar eventos de cruce al cambiar de mercado
  }, [initialPriceHistory, marketId]);


  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setPriceHistory(prevHistory => {
        if (prevHistory.length === 0) {
          // console.warn("Intento de actualizar gráfico sin historial previo para", marketId);
          return prevHistory; 
        }
        const lastPoint = prevHistory[prevHistory.length - 1];
        if (!lastPoint || typeof lastPoint.price !== 'number') {
            // console.warn("Último punto inválido o sin precio:", lastPoint);
            return prevHistory;
        }

        // Simular un nuevo precio
        let newPrice = lastPoint.price * (1 + (Math.random() - 0.495) * 0.001); // Variación pequeña
        if (newPrice <=0) newPrice = lastPoint.price > 0 ? lastPoint.price * 0.99 : 0.00001; // Evitar precios negativos/cero
        
        const newPoint: MarketPriceDataPoint = {
          timestamp: Math.floor(Date.now() / 1000), // Timestamp actual en segundos
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
  }, [marketId]); // Reiniciar intervalo si marketId cambia

  const chartDataWithSMAs = useMemo(() => {
    const sma10Values = calculateSMA(priceHistory, SMA10_PERIOD);
    const sma20Values = calculateSMA(priceHistory, SMA20_PERIOD);
    const sma50Values = calculateSMA(priceHistory, SMA50_PERIOD);
    return priceHistory.map((point, index) => ({
      ...point,
      date: format(fromUnixTime(point.timestamp), 'HH:mm:ss', { locale: es }),
      sma10: sma10Values[index],
      sma20: sma20Values[index],
      sma50: sma50Values[index],
    }));
  }, [priceHistory]);

  // Detectar cruces de SMA
  useEffect(() => {
    if (chartDataWithSMAs.length < 2) return;

    const lastPoint = chartDataWithSMAs[chartDataWithSMAs.length - 1];
    const prevPoint = chartDataWithSMAs[chartDataWithSMAs.length - 2];

    if (lastPoint && prevPoint && typeof lastPoint.sma10 === 'number' && typeof lastPoint.sma20 === 'number' &&
        typeof prevPoint.sma10 === 'number' && typeof prevPoint.sma20 === 'number') {
      
      let newCrossoverEvent: SmaCrossoverEvent | null = null;

      // Cruce Dorado (SMA10 cruza por encima de SMA20)
      if (prevPoint.sma10 < prevPoint.sma20 && lastPoint.sma10 > lastPoint.sma20) {
        newCrossoverEvent = {
          timestamp: lastPoint.timestamp,
          price: lastPoint.price,
          type: 'SMA_CROSS_BUY',
        };
      }
      // Cruce de la Muerte (SMA10 cruza por debajo de SMA20)
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
  // Asumir que el quoteAsset es USD si no se puede determinar (esto es una simplificación)
  const quoteAsset = marketId.split(marketName.split('/')[0])[1] || 'USD'; 
  
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
                right: 20, // Espacio para las etiquetas del eje Y
                top: 5,
                bottom: 20, // Espacio para la leyenda
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                // Mostrar menos ticks si hay muchos puntos, pero asegurar extremos
                tickFormatter={(value, index) => {
                  // Mostrar el primer, el último, y algunos intermedios (aprox cada 1/7 de los puntos)
                  if (chartDataWithSMAs.length > 10 && index % Math.floor(chartDataWithSMAs.length / 7) !== 0 && index !== chartDataWithSMAs.length -1 && index !== 0) return '';
                  return value; // value ya es HH:mm:ss
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                interval="preserveStartEnd" // Asegura que se muestren el primer y último tick
              />
              <YAxis
                yAxisId="left" // Es importante si tienes múltiples ejes Y
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}`}
                stroke="hsl(var(--muted-foreground))"
                domain={['auto', 'auto']} // Dominio automático para el precio
                fontSize={11}
                width={85} // Ancho para las etiquetas del eje Y
              />
              <ChartTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1.5, strokeDasharray: "3 3"}}
                content={<ChartTooltipContent 
                            indicator="line" 
                            labelClassName="text-foreground text-sm" 
                            className="bg-popover text-popover-foreground border-popover-foreground/50 shadow-xl" 
                            formatter={(value, name, props) => {
                              const currency = quoteAsset; // Usar el quoteAsset determinado
                              const rawValue = props.payload?.[name as keyof typeof props.payload] as number | undefined;
                              
                              // Formatear solo si es un precio o SMA
                              if (name === 'price' || name === 'sma10' || name === 'sma20' || name === 'sma50') {
                                return [
                                  rawValue?.toLocaleString(undefined, {style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5}),
                                  marketPriceChartConfigDark[name as keyof typeof marketPriceChartConfigDark]?.label || name
                                ];
                              }
                              return [value, name]; // Devolver valor/nombre por defecto para otros casos
                            }}
                            labelFormatter={(label, payload) => { // 'label' aquí es el valor del eje X (nuestra 'date' HH:mm:ss)
                              // Intentar obtener el timestamp original del payload para un formato más completo si es necesario
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
                stroke="hsl(var(--chart-1))" // Azul
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={marketPriceChartConfigDark.price.label as string}
              />
              <Line
                yAxisId="left"
                dataKey="sma10"
                type="monotone"
                stroke="hsl(var(--chart-5))" // Morado
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-5))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma10.label as string}
                connectNulls={true} // Conectar si hay valores nulos (al inicio)
              />
              <Line
                yAxisId="left"
                dataKey="sma20"
                type="monotone"
                stroke="hsl(var(--chart-2))" // Amarillo
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma20.label as string}
                connectNulls={true}
              />
              <Line
                yAxisId="left"
                dataKey="sma50"
                type="monotone"
                stroke="hsl(var(--chart-4))" // Rojo/Rosa
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-4))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma50.label as string}
                connectNulls={true}
              />
              {/* Señales de IA */}
              {aiSignalEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left"
                  key={`ai-signal-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={7} // Más grande para señales de IA
                  fill={event.type === 'BUY' ? marketPriceChartConfigDark.aiBuySignal.color : marketPriceChartConfigDark.aiSellSignal.color} 
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain" // Asegura que el punto sea visible incluso si está fuera del dominio actual del eje Y
                  isFront={true} // Dibujar encima de las líneas
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
                    cursor={false} // No mostrar cursor de tooltip para el punto
                    wrapperStyle={{ zIndex: 1000 }} // Asegurar que el tooltip esté por encima
                  />
                </ReferenceDot>
              ))}
              {/* Señales de Cruce de SMA */}
              {smaCrossoverEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left"
                  key={`sma-cross-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={5} // Ligeramente más pequeño que las señales de IA
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
        <div className="flex gap-2 font-medium leading-none text-foreground flex-wrap"> {/* Added flex-wrap */}
          <span>Último precio ({marketName}): ${lastPoint.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}.</span>
           {lastPoint.sma10 !== undefined && <span style={{color: marketPriceChartConfigDark.sma10.color}}>SMA10: ${lastPoint.sma10.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma20 !== undefined && <span style={{color: marketPriceChartConfigDark.sma20.color}}>SMA20: ${lastPoint.sma20.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
           {lastPoint.sma50 !== undefined && <span style={{color: marketPriceChartConfigDark.sma50.color}}>SMA50: ${lastPoint.sma50.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
        </div>
        <div className="leading-none text-muted-foreground">
          Actualizando cada {UPDATE_INTERVAL_MS / 1000} segundos. Mostrando últimos {MAX_DATA_POINTS} puntos.
        </div>
      </CardFooter>
    </Card>
  )
}
