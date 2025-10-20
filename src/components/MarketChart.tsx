import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  ComposedChart,
  Bar,
  ReferenceLine,
  Legend,
  CartesianGrid,
  ReferenceArea
} from 'recharts';
import { Market, MarketPriceDataPoint } from '@/lib/types';
import clsx from 'clsx';

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

interface StrategyLog {
  timestamp: number;
  message: string;
  details?: {
    action?: 'buy' | 'sell' | 'hold';
    [key: string]: any;
  };
}

interface MarketChartProps {
  data: MarketPriceDataPoint[];
  selectedMarket: Market | null;
  strategyLogs: StrategyLog[];
  chartColors: typeof CHART_COLORS;
}

export const CHART_COLORS = {
  priceUp: '#22c55e',
  priceDown: '#ef4444',
  sma10: '#34d399',
  sma20: '#8b5cf6',
  sma50: '#f97316',
  macdLine: '#3b82f6',
  signalLine: '#ec4899',
  macdHistogramUp: 'rgba(59, 130, 246, 0.5)',
  macdHistogramDown: 'rgba(236, 72, 153, 0.5)',
  rsi: '#a855f7',
  bollingerBands: 'rgba(107, 114, 128, 0.2)',
  buyZoneWeak: 'rgba(59, 130, 246, 0.1)',
  buyZoneStrong: 'rgba(59, 130, 246, 0.25)',
  sellZoneWeak: 'rgba(192, 38, 211, 0.1)',
  sellZoneStrong: 'rgba(192, 38, 211, 0.25)',
  signalBuyLine: '#22c55e',
  signalSellLine: '#ef4444',
};

const CustomLegend = (props: any) => {
    const { payload } = props;
    const customLegendItems = [
      { color: CHART_COLORS.buyZoneWeak, value: "Zona Compra Débil" },
      { color: CHART_COLORS.buyZoneStrong, value: "Zona Compra Fuerte" },
      { color: CHART_COLORS.sellZoneWeak, value: "Zona Venta Débil" },
      { color: CHART_COLORS.sellZoneStrong, value: "Zona Venta Fuerte" },
    ];
  
    return (
      <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
        {payload.map((entry: any, index: number) => {
          if (['candle_body', 'macdHistogram'].includes(entry.dataKey)) {
            return null;
          }
          return (
            <div key={`item-${index}`} className="flex items-center gap-2">
              <span style={{ backgroundColor: entry.color, width: '10px', height: '10px', display: 'inline-block' }}></span>
              <span>{entry.value}</span>
            </div>
          )
        })}
        {customLegendItems.map((item, index) => (
          <div key={`custom-item-${index}`} className="flex items-center gap-2">
            <span style={{ backgroundColor: item.color, width: '10px', height: '10px', display: 'inline-block' }}></span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    );
  };
  
export const MarketChart: React.FC<MarketChartProps> = ({ data, selectedMarket, strategyLogs, chartColors }) => {
  const pricePrecision = selectedMarket?.pricePrecision || 2;
  const amountPrecision = selectedMarket?.precision.amount || 2;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const cleanedData = useMemo(() => {
    return data.filter(dp =>
      dp && typeof dp === 'object' &&
      [dp.timestamp, dp.openPrice, dp.highPrice, dp.lowPrice, dp.closePrice].every(isValidNumber)
    );
  }, [data]);

  const yAxisPriceDomain = useMemo(() => {
    if (cleanedData.length === 0) return ['auto', 'auto'];
    const prices = cleanedData.flatMap(d => [d.highPrice, d.lowPrice]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const margin = (maxPrice - minPrice) * 0.1;
    return [minPrice - margin, maxPrice + margin];
  }, [cleanedData]);
  
  const yAxisIndicatorDomain = useMemo(() => {
    const rsiValues = cleanedData.map(d => d.rsi).filter(isValidNumber);
    const macdValues = cleanedData.flatMap(d => [d.macdLine, d.signalLine]).filter(isValidNumber);
    const allValues = [...rsiValues, ...macdValues];
    if (allValues.length === 0) return [-10, 110];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const margin = (max - min) * 0.1;
    return [min - margin, max + margin];
  }, [cleanedData]);


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-background/90 p-3 rounded-md shadow-lg text-foreground text-xs space-y-1 border border-border backdrop-blur-sm">
          <p className="font-bold">Hora: {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          <p>Open: <span className="font-mono">{isValidNumber(dataPoint.openPrice) ? dataPoint.openPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>High: <span className="font-mono">{isValidNumber(dataPoint.highPrice) ? dataPoint.highPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Low: <span className="font-mono">{isValidNumber(dataPoint.lowPrice) ? dataPoint.lowPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Close: <span className="font-mono">{isValidNumber(dataPoint.closePrice) ? dataPoint.closePrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          {isValidNumber(dataPoint.volume) && <p>Volume: <span className="font-mono">{dataPoint.volume.toFixed(amountPrecision)}</span></p>}
          {isValidNumber(dataPoint.sma10) && <p style={{color: chartColors.sma10}}>SMA10: <span className="font-mono">{dataPoint.sma10.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma20) && <p style={{color: chartColors.sma20}}>SMA20: <span className="font-mono">{dataPoint.sma20.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma50) && <p style={{color: chartColors.sma50}}>SMA50: <span className="font-mono">{dataPoint.sma50.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.rsi) && <p style={{color: chartColors.rsi}}>RSI: <span className="font-mono">{dataPoint.rsi.toFixed(2)}</span></p>}
          {isValidNumber(dataPoint.macdLine) && <p style={{color: chartColors.macdLine}}>MACD: <span className="font-mono">{dataPoint.macdLine.toFixed(4)}</span></p>}
          {isValidNumber(dataPoint.signalLine) && <p style={{color: chartColors.signalLine}}>Signal: <span className="font-mono">{dataPoint.signalLine.toFixed(4)}</span></p>}
        </div>
      );
    }
    return null;
  };
  
  const renderStrategyReferenceAreas = () => {
    const areas = [];
    if (cleanedData.length < 2) return null;

    for (let i = 1; i < cleanedData.length; i++) {
        const start = cleanedData[i-1];
        const end = cleanedData[i];
        let fill = 'transparent';

        if ((end.buyConditionsMet || 0) >= 2) fill = chartColors.buyZoneStrong;
        else if ((end.buyConditionsMet || 0) === 1) fill = chartColors.buyZoneWeak;
        else if ((end.sellConditionsMet || 0) >= 1) fill = chartColors.sellZoneStrong;
        
        if (fill !== 'transparent') {
            areas.push(
                <ReferenceArea key={`strat-area-${end.timestamp}`} x1={start.timestamp} x2={end.timestamp} yAxisId="priceAxis" fill={fill} stroke="none" ifOverflow="hidden" />
            );
        }
    }
    return areas;
  };

  if (!isMounted || cleanedData.length === 0) {
    return <div className="flex items-center justify-center h-[600px] text-gray-500 dark:text-gray-400">Cargando datos de mercado...</div>;
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={cleanedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} minTickGap={50} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={{ stroke: '#4b5563' }} tickLine={{ stroke: '#4b5563' }} />
          <YAxis yAxisId="priceAxis" orientation="right" domain={yAxisPriceDomain} tickFormatter={(value) => isValidNumber(value) ? `$${value.toLocaleString(undefined, {minimumFractionDigits: pricePrecision, maximumFractionDigits: pricePrecision})}` : ''} width={80} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={{ stroke: '#4b5563' }} tickLine={{ stroke: '#4b5563' }} />
          <YAxis yAxisId="indicatorAxis" orientation="left" domain={yAxisIndicatorDomain} tickFormatter={(value) => isValidNumber(value) ? value.toFixed(0) : ''} width={40} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={{ stroke: '#4b5563' }} tickLine={{ stroke: '#4b5563' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />

          {renderStrategyReferenceAreas()}

          {/* Indicadores ligados al Eje de Indicadores (Izquierda) */}
          <Line yAxisId="indicatorAxis" type="monotone" dataKey="rsi" stroke={chartColors.rsi} strokeWidth={1} dot={false} name="RSI" />
          <Line yAxisId="indicatorAxis" type="monotone" dataKey="macdLine" stroke={chartColors.macdLine} strokeWidth={1} dot={false} name="MACD" />
          <Line yAxisId="indicatorAxis" type="monotone" dataKey="signalLine" stroke={chartColors.signalLine} strokeWidth={1} dot={false} name="Signal" />
          <Bar yAxisId="indicatorAxis" dataKey="macdHistogram" name="MACD Hist.">
            {cleanedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.macdHistogram && entry.macdHistogram > 0 ? chartColors.macdHistogramUp : chartColors.macdHistogramDown} />
            ))}
          </Bar>

          {/* Indicadores ligados al Eje de Precios (Derecha) */}
          <Line yAxisId="priceAxis" type="linear" dataKey="closePrice" stroke="transparent" dot={false} name="Precio" legendType="none" />
          <Bar yAxisId="priceAxis" dataKey="candle_body" name="Velas">
            {cleanedData.map((entry, index) => (
                <Cell key={`cell-candle-${index}`} fill={entry.closePrice >= entry.openPrice ? chartColors.priceUp : chartColors.priceDown} />
            ))}
          </Bar>
          <Line yAxisId="priceAxis" type="monotone" dataKey="sma10" stroke={chartColors.sma10} strokeWidth={2} dot={false} name="SMA 10" />
          <Line yAxisId="priceAxis" type="monotone" dataKey="sma20" stroke={chartColors.sma20} strokeWidth={2} dot={false} name="SMA 20" />
          <Line yAxisId="priceAxis" type="monotone" dataKey="sma50" stroke={chartColors.sma50} strokeWidth={2} dot={false} name="SMA 50" />

          {/* Bandas de Bollinger */}
          <Area yAxisId="priceAxis" type="monotone" dataKey="upperBollingerBand" stackId="bb" stroke={chartColors.bollingerBands} fill="none" name="Bandas Bollinger" />
          <Area yAxisId="priceAxis" type="monotone" dataKey="lowerBollingerBand" stackId="bb" stroke={chartColors.bollingerBands} fill={chartColors.bollingerBands} name="Bandas Bollinger" />


           {/* Líneas de Señal */}
           {strategyLogs.filter(log => log.details?.action === 'buy' || log.details?.action === 'sell').map((log, index) => (
                <ReferenceLine
                    key={`signal-line-${index}`}
                    yAxisId="priceAxis"
                    x={log.timestamp}
                    stroke={log.details.action === 'buy' ? chartColors.signalBuyLine : chartColors.signalSellLine}
                    strokeDasharray="3 3"
                    strokeWidth={2}
                >
                    <Legend type="none" />
                    <Tooltip content={
                        <div className="bg-background/90 p-2 border rounded text-xs">
                           <p className={clsx("font-bold", log.details.action === 'buy' ? 'text-green-500' : 'text-red-500')}>
                            {log.details.action.toUpperCase()}
                           </p>
                           <p>Precio: {log.details.price.toFixed(pricePrecision)}</p>
                           <p>Hora: {new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                    } />
                </ReferenceLine>
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
