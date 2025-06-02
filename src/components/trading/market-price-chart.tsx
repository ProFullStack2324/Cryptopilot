// src/components/trading/market-price-chart.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Line, CartesianGrid, XAxis, YAxis, ReferenceLine, Legend, Bar, ComposedChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  MarketPriceDataPoint,
  PRICE_HISTORY_POINTS_TO_KEEP,
  marketPriceChartConfigDark,
  SignalEvent,
  SmaCrossoverEvent,
} from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChartIcon } from "lucide-react";
import { useBinanceMarketData } from '@/hooks/useBinanceMarketData'; // Importación correcta del hook de Binance

interface MarketPriceChartProps {
  marketId: string; // BTCUSDT
  marketName: string; // BTC/USD
  aiSignalEvents?: SignalEvent[];
  smaCrossoverEvents?: SmaCrossoverEvent[];
  isBotActive: boolean;
}

const DynamicChartContainer = dynamic(
  () => import("@/components/ui/chart").then((mod) => mod.ChartContainer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        Cargando gráfico...
      </div>
    ),
  }
);

export function MarketPriceChart({
  marketId,
  marketName,
  aiSignalEvents = [],
  smaCrossoverEvents = [],
  isBotActive,
}: MarketPriceChartProps) {
  const [chartData, setChartData] = useState<MarketPriceDataPoint[]>([]);

  // *** AQUI ESTÁ EL AJUSTE CLAVE: Usar useBinanceMarketData ***
  const { marketPrice, marketHistory, isLoading, error } = useBinanceMarketData({
    symbol: marketId, // Pasa el marketId al hook
    timeframe: "1m", // Puedes ajustar esto según tus necesidades (ej: "5m", "1h")
    limit: PRICE_HISTORY_POINTS_TO_KEEP,
    initialFetch: true, // Asegúrate de que el fetch inicial esté activado
  });
  // ************************************************************

  // Inicializar chartData con el historial de Binance si está disponible
  useEffect(() => {
    if (marketHistory.length > 0 && chartData.length === 0) {
      console.log("[MarketPriceChart] Inicializando gráfico con historial de Binance:", marketHistory.length, "puntos.");
      setChartData(marketHistory.slice(-PRICE_HISTORY_POINTS_TO_KEEP));
    }
  }, [marketHistory, chartData.length]);

  // Actualizar chartData con los nuevos precios en tiempo real de Binance
  useEffect(() => {
    // Solo actualizamos si no está cargando, si tenemos un precio y ya hay datos en la gráfica.
    // El hook useBinanceMarketData ya maneja la lógica de actualización por intervalo.
    // Este useEffect se encargará de reaccionar a los cambios en `marketPrice` y `marketHistory`
    // que vienen del hook, y no intentará hacer su propia lógica de "pulso" como antes.

    if (!isLoading && marketPrice !== null && marketHistory.length > 0) {
        // La lógica de añadir el último punto y mantener el tamaño debería estar cubierta
        // por `useBinanceMarketData` si `limit` se usa correctamente al traer los `klines`.
        // Si el hook ya te devuelve el historial siempre del tamaño correcto,
        // simplemente puedes hacer:
        setChartData(marketHistory);

        // Si prefieres que este componente aún maneje la adición del último punto para suavizar,
        // y solo marketHistory sea para la inicialización, puedes hacer lo siguiente:
        // const latestChartTimestamp = chartData[chartData.length - 1]?.timestamp;
        // const nowInSeconds = Math.floor(Date.now() / 1000);

        // // Solo añade si el precio ha cambiado o si ha pasado un tiempo suficiente para el timeframe
        // // (asumiendo que marketPrice se actualiza a intervalos de 1 minuto o más)
        // if (
        //   marketPrice === chartData[chartData.length - 1]?.price &&
        //   Math.abs(nowInSeconds - latestChartTimestamp) < 60 // Ajusta este 60 si tu timeframe es diferente
        // ) {
        //   return;
        // }

        // const newPoint: MarketPriceDataPoint = {
        //   timestamp: nowInSeconds, // Usar la hora actual para el último punto si no viene del kline
        //   price: marketPrice,
        //   volume: chartData.length > 0 ? chartData[chartData.length - 1].volume : 0, // Volumen simulado si no hay uno real
        // };

        // setChartData((prevData) => {
        //   const updatedData = [...prevData, newPoint];
        //   if (updatedData.length > PRICE_HISTORY_POINTS_TO_KEEP) {
        //     return updatedData.slice(updatedData.length - PRICE_HISTORY_POINTS_TO_KEEP);
        //   }
        //   return updatedData;
        // });
    }
  }, [marketPrice, isLoading, marketHistory]); // Dependencias: marketPrice y marketHistory del hook

  // --- FUNCIÓN HELPER PARA CALCULAR EMA (Sin cambios) ---
  const calculateEMA = useCallback((data: number[], period: number) => {
    if (data.length < period) return new Array(data.length).fill(undefined);
    const emaValues: (number | undefined)[] = new Array(data.length).fill(undefined);
    const multiplier = 2 / (period + 1);

    const initialSum = data.slice(0, period).reduce((acc, curr) => acc + curr, 0);
    emaValues[period - 1] = initialSum / period;

    for (let i = period; i < data.length; i++) {
      if (emaValues[i - 1] === undefined) {
          emaValues[i] = undefined;
      } else {
        emaValues[i] = (data[i] - emaValues[i - 1]!) * multiplier + emaValues[i - 1]!;
      }
    }
    return emaValues;
  }, []);

  // --- CÁLCULO DE SMAS, SEÑALES Y MACD (Sin cambios, usa chartData) ---
  const chartDataWithSignalsAndMACD = useMemo(() => {
    if (!chartData.length) return [];

    const signalMap = new Map<number, { aiBuy?: boolean; aiSell?: boolean; smaCrossBuy?: boolean; smaCrossSell?: boolean }>();

    aiSignalEvents.forEach(event => {
      signalMap.set(event.timestamp, {
        ...(signalMap.get(event.timestamp) || {}),
        [event.type === 'BUY' ? 'aiBuy' : 'aiSell']: true,
      });
    });

    smaCrossoverEvents.forEach(event => {
      signalMap.set(event.timestamp, {
        ...(signalMap.get(event.timestamp) || {}),
        [event.type === 'SMA_CROSS_BUY' ? 'smaCrossBuy' : 'smaCrossSell']: true,
      });
    });

    const calculateSMA = (data: MarketPriceDataPoint[], period: number) => {
        if (data.length < period) return new Array(data.length).fill(undefined);
        const smaValues: (number | undefined)[] = new Array(data.length).fill(undefined);
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.price, 0);
            smaValues[i] = sum / period;
        }
        return smaValues;
    };

    const prices = chartData.map(d => d.price);

    const sma10Values = calculateSMA(chartData, 10);
    const sma20Values = calculateSMA(chartData, 20);
    const sma50Values = calculateSMA(chartData, 50);

    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);

    const macdLineValues: (number | undefined)[] = prices.map((_, i) =>
      ema12[i] !== undefined && ema26[i] !== undefined ? ema12[i]! - ema26[i]! : undefined
    );

    const definedMacdLines = macdLineValues.filter((v): v is number => v !== undefined);
    const signalLineRawValues = calculateEMA(definedMacdLines, 9);

    const fullSignalLineValues: (number | undefined)[] = new Array(prices.length).fill(undefined);
    let signalLineRawIndex = 0;
    for (let i = 0; i < macdLineValues.length; i++) {
      if (macdLineValues[i] !== undefined) {
        if (signalLineRawIndex < signalLineRawValues.length) {
          fullSignalLineValues[i] = signalLineRawValues[signalLineRawIndex];
          signalLineRawIndex++;
        }
      }
    }

    const macdHistogramValues: (number | undefined)[] = prices.map((_, i) =>
      macdLineValues[i] !== undefined && fullSignalLineValues[i] !== undefined
        ? macdLineValues[i]! - fullSignalLineValues[i]!
        : undefined
    );

    return chartData.map((dataPoint, index) => {
      const signals = signalMap.get(dataPoint.timestamp);
      return {
        ...dataPoint,
        ...(isBotActive && signals ? {
          aiBuySignal: signals.aiBuy ? dataPoint.price : undefined,
          aiSellSignal: signals.aiSell ? dataPoint.price : undefined,
          smaCrossBuySignal: signals.smaCrossBuy ? dataPoint.price : undefined,
          smaCrossSellSignal: signals.smaCrossSell ? dataPoint.price : undefined,
        } : {}),
        sma10: sma10Values[index],
        sma20: sma20Values[index],
        sma50: sma50Values[index],
        macdLine: macdLineValues[index],
        signalLine: fullSignalLineValues[index],
        macdHistogram: macdHistogramValues[index],
      };
    });
  }, [chartData, aiSignalEvents, smaCrossoverEvents, isBotActive, calculateEMA]);

  // --- MANEJO DE ESTADOS DE CARGA Y ERROR (Adaptado para useBinanceMarketData) ---
  if (!chartDataWithSignalsAndMACD.length && isLoading) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground mt-4">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center text-base">
            <LineChartIcon className="h-5 w-5 mr-2 text-primary" />
            {marketName}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Cargando historial de precios...</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <div className="h-full w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }

  if (error && !chartDataWithSignalsAndMACD.length) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground mt-4">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center text-base">
            <LineChartIcon className="h-5 w-5 mr-2 text-destructive" />
            {marketName}
          </CardTitle>
          <CardDescription className="text-xs text-destructive">Error al cargar precios: {error}</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-destructive">
          No se pudieron cargar los datos del gráfico. Por favor, intente de nuevo más tarde.
        </CardContent>
      </Card>
    );
  }

  // --- RENDERIZADO DEL GRÁFICO (Sin cambios mayores, solo el último precio) ---
  return (
    <Card className="shadow-lg bg-card text-card-foreground mt-4">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center text-base">
          <LineChartIcon className="h-5 w-5 mr-2 text-primary" />
          {marketName}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Historial de precios y señales</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <DynamicChartContainer config={marketPriceChartConfigDark} className="h-[350px] w-full">
          <ComposedChart
            accessibilityLayer
            data={chartDataWithSignalsAndMACD}
            margin={{
              left: 0,
              right: 12,
              top: 5,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => format(new Date(value * 1000), 'HH:mm', { locale: es })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              stroke="hsl(var(--muted-foreground))"
              domain={['dataMin', 'dataMax']}
              fontSize={10}
              width={60}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={<ChartTooltipContent
                indicator="line"
                labelClassName="text-foreground"
                className="bg-popover text-popover-foreground border-popover-foreground/50"
                formatter={(value, name, props) => {
                  const rawValue = props.payload?.[name as keyof typeof props.payload] as number | undefined;
                  if (name === 'macdHistogram') {
                      return [
                        rawValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                        marketPriceChartConfigDark[name as keyof typeof marketPriceChartConfigDark]?.label || name
                      ];
                  }
                  return [
                    rawValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    marketPriceChartConfigDark[name as keyof typeof marketPriceChartConfigDark]?.label || name
                  ];
                }}
              />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ top: -20, right: 0, fontSize: 10, lineHeight: '10px' }}
              iconType="plainline"
            />

            <Line
              dataKey="price"
              type="monotone"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
              name={marketPriceChartConfigDark.price.label as string}
            />
            {chartDataWithSignalsAndMACD.some(d => d.sma10 !== undefined) && (
              <Line
                dataKey="sma10"
                type="monotone"
                stroke="hsl(var(--chart-5))"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-5))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma10.label as string}
              />
            )}
            {chartDataWithSignalsAndMACD.some(d => d.sma20 !== undefined) && (
              <Line
                dataKey="sma20"
                type="monotone"
                stroke="hsl(var(--chart-2))"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma20.label as string}
              />
            )}
            {chartDataWithSignalsAndMACD.some(d => d.sma50 !== undefined) && (
              <Line
                dataKey="sma50"
                type="monotone"
                stroke="hsl(var(--chart-4))"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--chart-4))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
                name={marketPriceChartConfigDark.sma50.label as string}
              />
            )}
            {isBotActive && (
              <>
                <Line
                  dataKey="aiBuySignal"
                  type="monotone"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={0}
                  dot={{ r: 4, fill: "hsl(var(--chart-3))", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "hsl(var(--chart-3))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  name={marketPriceChartConfigDark.aiBuySignal.label as string}
                />
                <Line
                  dataKey="aiSellSignal"
                  type="monotone"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={0}
                  dot={{ r: 4, fill: "hsl(var(--destructive))", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "hsl(var(--destructive))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  name={marketPriceChartConfigDark.aiSellSignal.label as string}
                />
                <Line
                  dataKey="smaCrossBuySignal"
                  type="monotone"
                  stroke="hsl(var(--chart-3) / 0.7)"
                  strokeWidth={0}
                  dot={{ r: 4, fill: "hsl(var(--chart-3) / 0.7)", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "hsl(var(--chart-3) / 0.7)", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  name={marketPriceChartConfigDark.smaCrossBuySignal.label as string}
                />
                <Line
                  dataKey="smaCrossSellSignal"
                  type="monotone"
                  stroke="hsl(var(--destructive) / 0.7)"
                  strokeWidth={0}
                  dot={{ r: 4, fill: "hsl(var(--destructive) / 0.7)", stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: "hsl(var(--destructive) / 0.7)", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  name={marketPriceChartConfigDark.smaCrossSellSignal.label as string}
                />
              </>
            )}

            <YAxis
              dataKey="macdLine"
              orientation="right"
              yAxisId="macd"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              domain={['dataMin', 'dataMax']}
              width={60}
            />
            <Bar
              dataKey="macdHistogram"
              yAxisId="macd"
              barSize={2}
              fill="currentColor"
              name={marketPriceChartConfigDark.macdHistogram.label as string}
              fillOpacity={0.7}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) => {
                const { x, y, width, height, value } = props;

                const numericValue = typeof value === 'number' ? value : 0;
                const isPositive = numericValue > 0;

                const actualX = typeof x === 'number' ? x : 0;
                const actualY = typeof y === 'number' ? y : 0;
                const actualWidth = typeof width === 'number' ? width : 0;
                const actualHeight = typeof height === 'number' ? height : 0;

                return (
                  <rect
                    x={actualX}
                    y={isPositive ? actualY : actualY + actualHeight}
                    width={actualWidth}
                    height={Math.abs(actualHeight)}
                    fill={isPositive ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"}
                  />
                );
              }}
            />

            <Line
              dataKey="macdLine"
              yAxisId="macd"
              type="monotone"
              stroke="hsl(var(--chart-6))"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--chart-6))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
              name={marketPriceChartConfigDark.macdLine.label as string}
            />
            <Line
              dataKey="signalLine"
              yAxisId="macd"
              type="monotone"
              stroke="hsl(var(--chart-7))"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--chart-7))", stroke: "hsl(var(--background))", strokeWidth: 1 }}
              name={marketPriceChartConfigDark.signalLine.label as string}
            />

            <ReferenceLine y={0} yAxisId="macd" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          </ComposedChart>
        </DynamicChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-xs pt-0 pb-3">
        <div className="flex gap-2 font-medium leading-none text-foreground">
          Último Precio: {
            isLoading ?
            <span className="text-muted-foreground">Cargando...</span> :
            marketPrice !== null ? // *** CAMBIO: Usar marketPrice de Binance ***
            `$${marketPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
            <span className="text-red-500">Error</span>
          }
        </div>
        <div className="leading-none text-muted-foreground">
          Datos en tiempo real (Binance) y señales {isBotActive ? "activas" : "inactivas"}. {/* Mensaje actualizado */}
        </div>
      </CardFooter>
    </Card>
  );
}