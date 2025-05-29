"use client"

import { TrendingUp } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceDot, Tooltip as RechartsTooltip, Legend } from "recharts"
import { // Comentamos ResponsiveContainer
  Card,
 CardContent, CardDescription, CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { MarketPriceDataPoint, SignalEvent, SmaCrossoverEvent, marketPriceChartConfigDark as marketPriceChartConfigDarkType } from "@/lib/types";
import { marketPriceChartConfigDark, PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types";
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useEffect, useState } from 'react';
import { Skeleton } from "@/components/ui/skeleton";


const SMA10_PERIOD = 10;
const SMA20_PERIOD = 20;
const SMA50_PERIOD = 50;
const MAX_SMA_CROSSOVER_EVENTS_ON_CHART = 5;


interface MarketPriceChartProps {
  marketId: string;
  marketName: string;
  initialPriceHistory: MarketPriceDataPoint[];
  aiSignalEvents?: SignalEvent[];
  smaCrossoverEvents?: SmaCrossoverEvent[]; // Prop para recibir los eventos
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


export function MarketPriceChart({ marketId, marketName, initialPriceHistory, aiSignalEvents = [], smaCrossoverEvents = [] }: MarketPriceChartProps) {
  const [isClient, setIsClient] = useState(false);
  // console.log("[MarketPriceChart] Componente renderizando. isClient:", isClient); // Mantener un console.log si es útil para depuración

  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartDataWithSMAs = useMemo(() => {
    if (!initialPriceHistory || initialPriceHistory.length === 0) return [];
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

  // console.log("[MarketPriceChart] Datos del gráfico (chartDataWithSMAs):", chartDataWithSMAs); // Mantener un console.log si es útil para depuración


  if (!initialPriceHistory || initialPriceHistory.length === 0) {
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

  const lastPoint = chartDataWithSMAs.length > 0 ? chartDataWithSMAs[chartDataWithSMAs.length -1] : { price: 0, sma10: undefined, sma20: undefined, sma50: undefined, timestamp: 0 };
  const quoteAsset = marketName.split('/')[1] || 'USD';

  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-xl">
          <TrendingUp className="h-6 w-6 mr-2 text-primary" />
          {marketName}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {marketId === "BTCUSDT" ? "Precio de BTC/USD (actualizado desde CoinGecko)" : "Historial de precios (simulado, actualizándose)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-2">
        {/* Reemplazamos ChartContainer con un div */}
        {/* El div tomará el tamaño de su padre CardContent */}
        <div className="h-full w-full" style={{ height: '400px' }}>
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
                tickFormatter={(value) => {
                  // Considerar si este formato de tick es necesario o si 'date' ya está en un formato usable por Recharts
 return value as string;
                }}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `$${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}`}
                stroke="hsl(var(--muted-foreground))"
                yAxisId="left"
                fontSize={11}
                width={85}
              />
              {/* Reemplazamos ChartTooltip con RechartsTooltip y adaptamos el content prop */}
              <RechartsTooltip
                cursor={{stroke: "hsl(var(--accent))", strokeWidth: 1.5, strokeDasharray: "3 3"}}
                content={(props) => {
                  const { active, payload } = props; // props viene del Tooltip, contiene active, payload, etc.
                  if (active && payload && payload.length) { // El payload contiene un array de objetos, cada uno por cada línea (price, sma10, etc.)
                    // El primer elemento (payload[0]) contiene el punto de datos completo
                    const point = payload[0].payload as MarketPriceDataPoint & { date: string; sma10?: number; sma20?: number; sma50?: number };
                    const currency = quoteAsset;
  
                    return (
                       <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                          {/* Muestra la hora del punto de datos */}
                          <p className="font-semibold mb-1">Hora: {format(fromUnixTime(point.timestamp), "Pp", { locale: es })}</p>
                          {/* Itera sobre los elementos del payload para mostrar cada línea (precio, SMAs) */}
                          {payload.map((entry) => {
                            const { name, value, color } = entry;
                            // Asegúrate de que 'name' es una clave válida en el objeto point y que sea uno de los dataKeys que queremos mostrar
                            const rawValue = point[name as keyof typeof point] as number | undefined;
  
                            if (rawValue !== undefined && name !== 'timestamp') { // Solo muestra si el valor existe (ej. SMAs no existen al principio) y no es el timestamp
                               const labelText = marketPriceChartConfigDark[name as keyof typeof marketPriceChartConfigDark]?.label || name;
                                return (
                                   <p key={`tooltip-item-${name}`} style={{ color }}>
                                     {labelText}: ${rawValue.toLocaleString('en-US', {style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}
                                   </p>
                                );
                             }
                              return null; // Ocultar si no es precio o SMA o si el valor es undefined
                            })}
                        </div>
                     );
                   }
                   return null; // No mostrar tooltip si no hay datos activos
                 }}
 wrapperStyle={{ zIndex: 1000 }} // Asegura que el tooltip esté por encima de otros elementos
 /> {/* Cierre del tooltip */}
 {/* Mantenemos Legend */}
 <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: "10px", textTransform: 'capitalize' }} />

              {/* Lineas de Precio y SMAs */}
              <Line
                yAxisId="left"
                dataKey="price"
                type="linear" // Cambiado a linear para asegurar dibujado continuo
                stroke="#00FF00" // Green
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                name={marketPriceChartConfigDark.price.label as string}
              />
              <Line
                yAxisId="left"
                dataKey="sma10"
                type="linear" // Cambiado a linear
                stroke="#FFFF00" // Yellow
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma10.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma10.label as string}
                connectNulls={true} // Permite que la línea se rompa si hay datos undefined
              />
              <Line
                yAxisId="left"
                dataKey="sma20"
                type="linear" // Cambiado a linear
                stroke="#FFA500" // Orange
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma20.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma20.label as string}
                connectNulls={true} // Permite que la línea se rompa si hay datos undefined
              />
              <Line
                yAxisId="left"
                dataKey="sma50"
                type="linear" // Cambiado a linear
                stroke="#FF0000" // Red
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: marketPriceChartConfigDark.sma50.color, stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma50.label as string}
                connectNulls={true} // Permite que la línea se rompa si hay datos undefined
              />
  
              {/* ReferenceDots para AI Signals */}
 {aiSignalEvents.map((event, index) => (
                <ReferenceDot
                  yAxisId="left" // Asegúrate que el YAxis id coincide
 key={`ai-signal-${index}-${event.timestamp + event.type}`} // Add type to key for uniqueness
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}
                  y={event.price}
                  r={7} // Radio del punto
                  fill={event.type === 'BUY' ? marketPriceChartConfigDark.aiBuySignal.color : marketPriceChartConfigDark.aiSellSignal.color}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  ifOverflow="extendDomain" // Comportamiento si el punto está fuera del rango visible
                  isFront={true} // Asegura que el punto esté al frente
                >
                  {/* Tooltip específico para este ReferenceDot */}
                  <RechartsTooltip
                    content={() => (
                      <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                        <p className="font-semibold">Señal IA: {event.type === 'BUY' ? 'COMPRA' : 'VENTA'}</p>
                        <p>Precio: ${event.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</p>
                        <p>Confianza: {(event.confidence * 100).toFixed(0)}%</p>
                        <p>Hora: {format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}</p>
                      </div>
                    )}
                    cursor={false} // No mostrar el cursor al pasar sobre el punto
                    wrapperStyle={{ zIndex: 1000 }} // Asegura que el tooltip esté al frente
                  />
                </ReferenceDot>
 ))}

              {/* ReferenceDots para SMA Crossovers */}
              {smaCrossoverEvents.map((event, index) => (
                <ReferenceDot
 yAxisId="left" // Asegúrate que el YAxis id coincide
                  key={`sma-cross-${index}-${event.timestamp}`}
                  x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })} // Asegúrate que el formato de fecha coincide con el XAxis
                  y={event.price}
                  r={5} // Radio del punto
                  fill={event.type === 'SMA_CROSS_BUY' ? marketPriceChartConfigDark.smaCrossBuySignal.color : marketPriceChartConfigDark.smaCrossSellSignal.color}
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain" // Comportamiento si el punto está fuera del rango visible
                  isFront={true} // Asegura que el punto esté al frente
                >
                  {/* Tooltip específico para este ReferenceDot */}
                  <RechartsTooltip
                    content={() => (
                      <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                        <p className="font-semibold">{event.type === 'SMA_CROSS_BUY' ? 'Cruce SMA: COMPRAR' : 'Cruce SMA: VENDER'}</p>
                        <p>Precio: ${event.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</p>
                        <p>Hora: {format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}</p>
                      </div>
                    )}
                    cursor={false} // No mostrar el cursor al pasar sobre el punto
                    wrapperStyle={{ zIndex: 1000 }} // Asegura que el tooltip esté al frente
                  />
                </ReferenceDot>
              ))}
            </LineChart>
        </div>
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-1 pb-3">
        {!isClient ? (
          <>
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </>
        ) : (
          <>
            <div className="flex gap-2 font-medium leading-none text-foreground flex-wrap text-sm"> {/* Ajustado tamaño de texto */}
              <span>Últ. precio ({marketName}): <span style={{color: marketPriceChartConfigDark.price.color}}>${lastPoint.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}.</span></span>
              {lastPoint.sma10 !== undefined && <span style={{color: marketPriceChartConfigDark.sma10.color}}>SMA10: ${lastPoint.sma10.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
              {lastPoint.sma20 !== undefined && <span style={{color: marketPriceChartConfigDark.sma20.color}}>SMA20: ${lastPoint.sma20.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
              {lastPoint.sma50 !== undefined && <span style={{color: marketPriceChartConfigDark.sma50.color}}>SMA50: ${lastPoint.sma50.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5})}</span>}
 </div>
            <div className="leading-none text-muted-foreground">
              {/* Actualizamos el texto para reflejar la frecuencia de actualización de CoinGecko */}
              {marketId === "BTCUSDT" ? `Actualizado desde CoinGecko cada ~60s. Mostrando ${PRICE_HISTORY_POINTS_TO_KEEP} puntos.` : `Simulación: actualizando cada 1.5-3s. Mostrando últimos ${PRICE_HISTORY_POINTS_TO_KEEP} puntos.`}
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}