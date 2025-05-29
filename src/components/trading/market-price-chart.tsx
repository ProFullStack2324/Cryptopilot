"use client" // Esta directiva indica que este módulo y sus hijos deben ejecutarse en el navegador, necesario para librerías como Recharts que interactúan con el DOM.

import { TrendingUp } from "lucide-react"
import { // Comentamos ResponsiveContainer
  Card,
 CardContent, CardDescription, CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { MarketPriceDataPoint, SignalEvent, SmaCrossoverEvent, marketPriceChartConfigDark as marketPriceChartConfigDarkType } from "@/lib/types";
import { marketPriceChartConfigDark, PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types";
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale'; // Asegúrate de tener 'date-fns' instalado
import { useMemo, useEffect, useState } from 'react';
import { ChartLoadingState } from "./chart-loading-state"; // Importar el nuevo componente de carga
import { ChartFooterInfo } from "./chart-footer-info"; // Importar el nuevo componente de pie de página
import ChartDisplay from "./chart-display"; // Importar el nuevo componente de visualización del gráfico


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
  console.log("[MarketPriceChart Container] Component rendered with props:", { marketId: marketId, marketName: marketName, initialPriceHistoryLength: initialPriceHistory ? initialPriceHistory.length : 0, aiSignalEventsLength: aiSignalEvents ? aiSignalEvents.length : 0, smaCrossoverEventsLength: smaCrossoverEvents ? smaCrossoverEvents.length : 0 });
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
  console.log("[MarketPriceChart Container] isClient state:", isClient);
  console.log("[MarketPriceChart Container] chartDataWithSMAs calculated. Length:", chartDataWithSMAs.length);

  // console.log("[MarketPriceChart] Datos del gráfico (chartDataWithSMAs):", chartDataWithSMAs); // Mantener un console.log si es útil para depuración

  console.log("[MarketPriceChart Container] Checking render condition. isClient:", isClient, "initialHistoryLength:", initialPriceHistory.length, "chartDataWithSMAsLength:", chartDataWithSMAs.length);

  // Sólo renderizar cuando estemos en cliente y tengamos datos válidos
  if (!isClient || !initialPriceHistory || initialPriceHistory.length === 0 || chartDataWithSMAs.length === 0) {
    return <ChartLoadingState marketName={marketName} />;
  }

  const lastPoint = chartDataWithSMAs.length > 0
  ? chartDataWithSMAs[chartDataWithSMAs.length - 1]
  : { price: 0, sma10: undefined, sma20: undefined, sma50: undefined, timestamp: Math.floor(Date.now() / 1000), date: format(new Date(), 'HH:mm:ss', { locale: es }) }; // <-- Añadimos date aquí
  const quoteAsset = marketName.split('/')[1] || 'USD';

  console.log("[MarketPriceChart Container] Rendering main Card with ChartDisplay and ChartFooterInfo.");
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
 {/* Renderizar el componente ChartDisplay */}
        <ChartDisplay
 chartDataWithSMAs={chartDataWithSMAs}
 aiSignalEvents={aiSignalEvents}
 smaCrossoverEvents={smaCrossoverEvents}
 quoteAsset={quoteAsset}
 marketName={marketName}
              />
      </CardContent>
       <CardFooter className="flex-col items-start gap-1 text-xs pt-1 pb-3">
 {/* Renderizar el componente ChartFooterInfo */}
 <ChartFooterInfo
 lastPoint={lastPoint}
 marketName={marketName}
 marketId={marketId}
 isClient={isClient}
 />
      </CardFooter>
    </Card>
  )
}