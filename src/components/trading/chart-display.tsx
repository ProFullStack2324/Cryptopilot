"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceDot, Tooltip as RechartsTooltip, Legend } from "recharts";
import type { MarketPriceDataPoint, SignalEvent, SmaCrossoverEvent } from "@/lib/types";
import { marketPriceChartConfigDark } from "@/lib/types";
import { format, fromUnixTime } from 'date-fns';
import { es } from 'date-fns/locale';
import { ResponsiveContainer } from 'recharts';


interface ChartDisplayProps {
  chartDataWithSMAs: (MarketPriceDataPoint & { date: string; sma10?: number; sma20?: number; sma50?: number })[];
  aiSignalEvents: SignalEvent[];
  smaCrossoverEvents: SmaCrossoverEvent[];
  quoteAsset: string;
  marketName: string;
}

// Sólo los keys de los datos que realmente existen en chartDataWithSMAs
type DataKey = 'price' | 'sma10' | 'sma20' | 'sma50';

export default function ChartDisplay({
  chartDataWithSMAs,
  aiSignalEvents,
  smaCrossoverEvents,
  quoteAsset,
  marketName,
}: ChartDisplayProps) {
  console.log("[ChartDisplay] Props:", {
    chartDataWithSMAsLength: chartDataWithSMAs.length,
    aiSignalEventsLength: aiSignalEvents.length,
    smaCrossoverEventsLength: smaCrossoverEvents.length,
    quoteAsset,
    marketName,
  });

  if (!chartDataWithSMAs || chartDataWithSMAs.length === 0) {
    console.warn("[ChartDisplay] No data to render chart.");
    return <div className="text-sm text-muted">No hay datos para mostrar.</div>;
  }

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <LineChart
        data={chartDataWithSMAs}
        margin={{ left: -10, right: 20, top: 5, bottom: 20 }}
      >
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value as string}
          stroke="#FFFFFF"
          fontSize={11}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) =>
            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5 })}`
          }
          stroke="#FFFFFF"
          yAxisId="left"
          fontSize={11}
          width={85}
          domain={[ 'auto', 'auto' ]}
        />

        <RechartsTooltip
          cursor={{ stroke: "#ccc", strokeWidth: 1.5, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const point = payload[0].payload as MarketPriceDataPoint & { date: string; sma10?: number; sma20?: number; sma50?: number };

            return (
              <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                <p className="font-semibold mb-1">Hora: {format(fromUnixTime(point.timestamp), "Pp", { locale: es })}</p>
                {payload.map((entry, idx) => {
                  // Usar dataKey en lugar de name para indexar
                  const key = entry.dataKey as DataKey;
                  const rawValue = point[key];
                  const config = marketPriceChartConfigDark[key];
                  const labelText = config?.label || key;
                  if (rawValue !== undefined) {
                    return (
                      <p key={`tooltip-${key}-${idx}`}>
                        {labelText}: {rawValue.toLocaleString('en-US', { style: 'currency', currency: quoteAsset, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5 })}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            );
          }}
          wrapperStyle={{ zIndex: 1000 }}
        />

        <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: "10px", textTransform: 'capitalize' }} />

        <Line yAxisId="left" dataKey="price" type="linear" stroke="#00FF00" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#00FF00", stroke: "#333", strokeWidth: 2 }} name="Precio" />
        <Line yAxisId="left" dataKey="sma10" type="linear" stroke="#FFFF00" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#FFFF00", stroke: "#333", strokeWidth: 1 }} name="SMA 10" connectNulls />
        <Line yAxisId="left" dataKey="sma20" type="linear" stroke="#FFA500" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#FFA500", stroke: "#333", strokeWidth: 1 }} name="SMA 20" connectNulls />
        <Line yAxisId="left" dataKey="sma50" type="linear" stroke="#FF0000" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#FF0000", stroke: "#333", strokeWidth: 1 }} name="SMA 50" connectNulls />

        {aiSignalEvents.map((event: SignalEvent, idx: number) => (
          <ReferenceDot key={`ai-${idx}`} yAxisId="left" x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })} y={event.price} r={7} fill={event.type === 'BUY' ? '#00CC00' : '#CC0000'} stroke="#333" strokeWidth={2} ifOverflow="extendDomain" isFront>
            <RechartsTooltip content={() => (
              <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                <p className="font-semibold">Señal IA: {event.type === 'BUY' ? 'COMPRA' : 'VENTA'}</p>
                <p>Precio: {event.price.toLocaleString('en-US', { style: 'currency', currency: quoteAsset, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5 })}</p>
                <p>Confianza: {(event.confidence * 100).toFixed(0)}%</p>
                <p>Hora: {format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}</p>
              </div>
            )} cursor={false} wrapperStyle={{ zIndex: 1000 }} />
          </ReferenceDot>
        ))}

        {smaCrossoverEvents.map((event: SmaCrossoverEvent, idx: number) => (
          <ReferenceDot key={`cross-${idx}`} yAxisId="left" x={format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })} y={event.price} r={5} fill={event.type === 'SMA_CROSS_BUY' ? '#00AA00' : '#AA0000'} stroke="#333" strokeWidth={1.5} ifOverflow="extendDomain" isFront>
            <RechartsTooltip content={() => (
              <div className="bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs border border-border">
                <p className="font-semibold">{event.type === 'SMA_CROSS_BUY' ? 'Cruce SMA: COMPRAR' : 'Cruce SMA: VENDER'}</p>
                <p>Precio: {event.price.toLocaleString('en-US', { style: 'currency', currency: quoteAsset, minimumFractionDigits: 2, maximumFractionDigits: marketName.includes('BTC') || marketName.includes('ETH') ? 2 : 5 })}</p>
                <p>Hora: {format(fromUnixTime(event.timestamp), 'HH:mm:ss', { locale: es })}</p>
              </div>
            )} cursor={false} wrapperStyle={{ zIndex: 1000 }} />
          </ReferenceDot>
        ))}
      </LineChart>
    </div>
  );
}