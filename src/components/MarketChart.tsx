import React, { useMemo, useState, useEffect, ReactElement } from 'react';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  ComposedChart,
  Bar,
  Cell,
  ReferenceDot,
  ReferenceArea,
  Legend,
  Scatter, // Necesario para dibujar las velas japonesas y señales de estrategia
  CartesianGrid, // Rejilla de fondo para el gráfico
  ReferenceLine // Para las líneas de señales de compra/venta
} from 'recharts';
import { Market, MarketPriceDataPoint } from '@/lib/types';
import clsx from 'clsx';
import { calculateSMA } from '@/lib/indicators';

// Helper para validar si un valor es un número válido (no undefined, null, NaN)
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Interfaz para registrar eventos de la estrategia de trading
interface StrategyLog {
    timestamp: number;
    message: string;
    details?: {
        action?: 'buy' | 'sell' | 'hold';
        [key: string]: any;
    };
}

// Propiedades que el componente MarketChart aceptará
interface MarketChartProps {
  data: MarketPriceDataPoint[];
  selectedMarket: Market | null;
  strategyLogs: StrategyLog[];
  chartColors: typeof CHART_COLORS;
}

// Definición de colores para la consistencia visual del gráfico
export const CHART_COLORS = {
  sma10: '#34d399', // emerald-400 (verde claro)
  sma20: '#8b5cf6', // violet-500 (violeta)
  sma50: '#f97316', // orange-500
  macdLine: '#3b82f6', // blue-500 (azul)
  signalLine: '#ef4444', // red-500 (rojo)
  macdHistogramPositive: 'rgba(16, 185, 129, 0.4)', // emerald-500 con opacidad
  macdHistogramNegative: 'rgba(239, 68, 68, 0.4)', // red-500 con opacidad
  rsi: '#a855f7', // purple-500 (púrpura)
  bollingerBands: 'rgba(167, 139, 250, 0.3)', // violet-400 con opacidad
  priceLine: '#6b7280', // gray-500
  signalBuy: '#22c55e', // green-500
  signalSell: '#ef4444', // red-500
  buyZoneWeak: 'rgba(16, 185, 129, 0.1)',   // Verde muy transparente
  buyZoneStrong: 'rgba(16, 185, 129, 0.25)', // Verde más intenso
  sellZoneWeak: 'rgba(239, 68, 68, 0.1)',  // Rojo muy transparente
  sellZoneStrong: 'rgba(239, 68, 68, 0.25)', // Rojo más intenso
};


// Componente principal del gráfico de mercado
export const MarketChart: React.FC<MarketChartProps> = ({ data, selectedMarket, strategyLogs, chartColors }) => {
  // Determina la precisión decimal para precios y cantidades
  const pricePrecision = selectedMarket?.pricePrecision || 2;
  const amountPrecision = selectedMarket?.precision.amount || 2;

  // Estado para controlar el montaje y asegurar que ResponsiveContainer renderice correctamente
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Mapea los logs de estrategia a un formato más accesible por timestamp
  const strategySignalsMap = useMemo(() => {
    const map = new Map<number, 'buy' | 'sell' | 'hold'>();
    strategyLogs.forEach(log => {
      if (isValidNumber(log.timestamp) && log.details?.action && ['buy', 'sell', 'hold'].includes(log.details.action)) {
        map.set(log.timestamp, log.details.action as 'buy' | 'sell' | 'hold');
      }
    });
    return map;
  }, [strategyLogs]);

  // Limpia y prepara los datos del gráfico
  const cleanedData = useMemo(() => {
    return data.filter(dp =>
      dp && typeof dp === 'object' &&
      [dp.timestamp, dp.openPrice, dp.highPrice, dp.lowPrice, dp.closePrice].every(isValidNumber)
    );
  }, [data]);

  if (cleanedData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">Cargando datos de mercado...</div>;
  }
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const signal = strategySignalsMap.get(dataPoint.timestamp);

      return (
        <div className="bg-background/90 p-3 rounded-md shadow-lg text-foreground text-xs space-y-1 border border-border backdrop-blur-sm">
          <p className="font-bold">Hora: {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          <p>Open: <span className="font-mono">{isValidNumber(dataPoint.openPrice) ? dataPoint.openPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>High: <span className="font-mono">{isValidNumber(dataPoint.highPrice) ? dataPoint.highPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Low: <span className="font-mono">{isValidNumber(dataPoint.lowPrice) ? dataPoint.lowPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Close: <span className="font-mono">{isValidNumber(dataPoint.closePrice) ? dataPoint.closePrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          {isValidNumber(dataPoint.volume) && <p>Volume: <span className="font-mono">{dataPoint.volume.toFixed(amountPrecision)}</span></p>}
          {isValidNumber(dataPoint.sma10) && <p>SMA10: <span className="font-mono">{dataPoint.sma10.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma20) && <p>SMA20: <span className="font-mono">{dataPoint.sma20.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma50) && <p>SMA50: <span className="font-mono">{dataPoint.sma50.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.rsi) && <p>RSI: <span className="font-mono">{dataPoint.rsi.toFixed(2)}</span></p>}
          {signal && (
            <p className={clsx("font-bold text-base mt-2", {
              'text-green-400': signal === 'buy',
              'text-red-400': signal === 'sell',
              'text-gray-400': signal === 'hold',
            })}>
              Señal: {signal.toUpperCase()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };
  
    // Función para renderizar las áreas de referencia de estrategia
    const renderStrategyReferenceAreas = () => {
        const areas = [];
        let segmentStart = null;

        for (let i = 0; i < cleanedData.length; i++) {
            const currentPoint = cleanedData[i];
            const currentBuyConditions = currentPoint.buyConditionsMet || 0;
            const currentSellConditions = currentPoint.sellConditionsMet || 0;

            if (segmentStart === null && (currentBuyConditions > 0 || currentSellConditions > 0)) {
                segmentStart = currentPoint.timestamp;
            } else if (segmentStart !== null) {
                const prevPoint = cleanedData[i - 1];
                const prevBuyConditions = prevPoint.buyConditionsMet || 0;
                const prevSellConditions = prevPoint.sellConditionsMet || 0;

                const conditionsChanged = currentBuyConditions !== prevBuyConditions || currentSellConditions !== prevSellConditions;
                const isLastPoint = i === cleanedData.length - 1;

                if (conditionsChanged || isLastPoint) {
                    const segmentEnd = isLastPoint ? currentPoint.timestamp : prevPoint.timestamp;
                    let fill = 'transparent';
                    if (prevBuyConditions >= 2) fill = chartColors.buyZoneStrong;
                    else if (prevBuyConditions === 1) fill = chartColors.buyZoneWeak;
                    else if (prevSellConditions >= 2) fill = chartColors.sellZoneStrong; // No tenemos 2 sell conditions, pero se deja por escalabilidad
                    else if (prevSellConditions === 1) fill = chartColors.sellZoneWeak;
                    
                    if (fill !== 'transparent') {
                        areas.push(
                            <ReferenceArea
                                key={`strat-area-${segmentStart}`}
                                x1={segmentStart}
                                x2={segmentEnd}
                                yAxisId="priceAxis"
                                fill={fill}
                                stroke="none"
                            />
                        );
                    }
                    segmentStart = (currentBuyConditions > 0 || currentSellConditions > 0) ? currentPoint.timestamp : null;
                }
            }
        }
        return areas;
    };

  return (
    <div className="flex flex-col w-full h-full">
      <div style={{ width: '100%', height: '500px' }}>
        {isMounted && <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cleanedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
            <XAxis
              dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              minTickGap={50} tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#4b5563' }} tickLine={{ stroke: '#4b5563' }}
            />
            <YAxis
              orientation="right" dataKey="closePrice" domain={['auto', 'auto']}
              tickFormatter={(value) => isValidNumber(value) ? value.toFixed(pricePrecision) : ''}
              width={80} tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#4b5563' }} tickLine={{ stroke: '#4b5563' }}
              mirror={false} yAxisId="priceAxis"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />

            {/* Zonas de Estrategia */}
            {renderStrategyReferenceAreas()}

            {/* Velas Japonesas (como Scatter para mechas, y Bar para cuerpo) */}
            <Scatter
              yAxisId="priceAxis"
              name="Velas"
              data={cleanedData}
              shape={({ x, y, payload }) => {
                const { highPrice, lowPrice } = payload;
                if (x === undefined || y === undefined || !isValidNumber(highPrice) || !isValidNumber(lowPrice)) return null;
                const color = payload.openPrice <= payload.closePrice ? chartColors.signalBuy : chartColors.signalSell;
                return <line x1={x} y1={y} x2={x} y2={y - (highPrice - lowPrice)} stroke={color} strokeWidth={1} />;
              }}
              isAnimationActive={false}
            />
            <Bar dataKey="closePrice" yAxisId="priceAxis" name="Cuerpo Vela" isAnimationActive={false} barSize={4}>
               {cleanedData.map((entry, index) => {
                 const color = entry.openPrice <= entry.closePrice ? chartColors.signalBuy : chartColors.signalSell;
                 return <Cell key={`cell-${index}`} fill={color} />;
               })}
             </Bar>


            {/* Líneas de Indicadores */}
            <Line yAxisId="priceAxis" type="monotone" dataKey="sma10" stroke={chartColors.sma10} dot={false} strokeWidth={2} name="SMA10" />
            <Line yAxisId="priceAxis" type="monotone" dataKey="sma20" stroke={chartColors.sma20} dot={false} strokeWidth={2} name="SMA20" />
            <Line yAxisId="priceAxis" type="monotone" dataKey="sma50" stroke={chartColors.sma50} dot={false} strokeWidth={1.5} name="SMA50" />
            <Area yAxisId="priceAxis" type="monotone" dataKey="upperBollingerBand" stackId="bb" stroke={chartColors.bollingerBands} fill="none" name="BB Superior" />
            <Area yAxisId="priceAxis" type="monotone" dataKey="lowerBollingerBand" stackId="bb" stroke={chartColors.bollingerBands} fill={chartColors.bollingerBands} name="BB Inferior" />

            {/* Líneas de Referencia para Señales de Compra/Venta */}
            {strategyLogs.map((log) => {
              if (log.details?.action === 'buy') {
                return ( <ReferenceLine key={`buy-${log.timestamp}`} x={log.timestamp} stroke={chartColors.signalBuy} strokeWidth={2} strokeDasharray="3 3" yAxisId="priceAxis" label={{ value: 'COMPRA', position: 'insideTopLeft', fill: chartColors.signalBuy, fontSize: 10 }} /> );
              }
              if (log.details?.action === 'sell') {
                return ( <ReferenceLine key={`sell-${log.timestamp}`} x={log.timestamp} stroke={chartColors.signalSell} strokeWidth={2} strokeDasharray="3 3" yAxisId="priceAxis" label={{ value: 'VENTA', position: 'insideBottomLeft', fill: chartColors.signalSell, fontSize: 10 }} /> );
              }
              return null;
            })}

            {/* Sección de Indicadores Inferiores (RSI, MACD) */}
            <YAxis yAxisId="rsiAxis" domain={[0, 100]} hide={true} />
            <Line yAxisId="rsiAxis" type="monotone" dataKey="rsi" stroke={chartColors.rsi} dot={false} strokeWidth={1.5} name="RSI" hide={true}/>

            <YAxis yAxisId="macdAxis" domain={['auto', 'auto']} hide={true} />
            <Line yAxisId="macdAxis" type="monotone" dataKey="macdLine" stroke={chartColors.macdLine} dot={false} strokeWidth={1.5} name="MACD" hide={true}/>
            <Line yAxisId="macdAxis" type="monotone" dataKey="signalLine" stroke={chartColors.signalLine} dot={false} strokeWidth={1.5} name="Signal" hide={true}/>
            <Bar yAxisId="macdAxis" dataKey="macdHistogram" name="Histograma" hide={true}>
              {cleanedData.map((entry, index) => (
                <Cell key={`cell-macd-${index}`} fill={isValidNumber(entry.macdHistogram) && entry.macdHistogram >= 0 ? chartColors.macdHistogramPositive : chartColors.macdHistogramNegative} />
              ))}
            </Bar>
            
          </ComposedChart>
        </ResponsiveContainer>}
      </div>
    </div>
  );
};
