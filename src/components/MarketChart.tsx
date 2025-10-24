
// ho la la
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  Cell, // Importar Cell
} from 'recharts';
import { Market, MarketPriceDataPoint } from '@/lib/types';
import clsx from 'clsx';

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

interface StrategyLog {
  timestamp: number;
  message: string;
  details?: {
    action?: 'buy' | 'sell' | 'hold';
    price?: number;
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
  sma10: '#34d399', // emerald-400
  sma20: '#8b5cf6', // violet-500
  sma50: '#f97316', // orange-500
  macdLine: '#3b82f6', // blue-500
  signalLine: '#ec4899', // pink-500
  macdHistogramUp: 'rgba(59, 130, 246, 0.4)',
  macdHistogramDown: 'rgba(236, 72, 153, 0.4)',
  rsi: '#a855f7', // purple-500
  bollingerBands: 'rgba(107, 114, 128, 0.2)', // gray-500
  // Nueva paleta para zonas de estrategia
  buyZoneWeak: 'rgba(59, 130, 246, 0.1)', // blue-500/10
  buyZoneStrong: 'rgba(59, 130, 246, 0.25)', // blue-500/25
  sellZoneWeak: 'rgba(192, 38, 211, 0.1)', // fuchsia-600/10
  sellZoneStrong: 'rgba(192, 38, 211, 0.25)', // fuchsia-600/25
  signalBuyLine: '#22c55e',
  signalSellLine: '#ef4444',
};

const CustomLegend = (props: any) => {
    const { payload } = props;
    const legendItemsMap = {
        'closePrice': 'Precio de Cierre',
        'sma10': 'SMA 10 (Tendencia Corto Plazo)',
        'sma20': 'SMA 20 (Tendencia Mediano Plazo)',
        'sma50': 'SMA 50 (Tendencia Largo Plazo)',
        'upperBollingerBand': 'Bandas de Bollinger (Volatilidad)',
        'rsi': 'RSI (Fuerza Relativa)',
        'macdLine': 'Línea MACD (Momento)',
        'signalLine': 'Línea de Señal (MACD)',
        'macdHistogram': 'Histograma MACD (Divergencia)',
    };

    const customLegendItems = [
      { color: CHART_COLORS.buyZoneWeak, value: "Zona Compra Débil (1 condición)" },
      { color: CHART_COLORS.buyZoneStrong, value: "Zona Compra Fuerte (>=2 condiciones)" },
      { color: CHART_COLORS.sellZoneWeak, value: "Zona Venta Débil (1 condición)" },
      { color: CHART_COLORS.sellZoneStrong, value: "Zona Venta Fuerte (>=1 condición)" },
    ];
  
    return (
      <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-muted-foreground">
        {payload.map((entry: any, index: number) => {
          const name = legendItemsMap[entry.dataKey as keyof typeof legendItemsMap] || entry.value;
          if (entry.dataKey === 'lowerBollingerBand') return null; // Ocultar de la leyenda

          return (
            <div key={`item-${index}`} className="flex items-center gap-2">
                <span style={{ backgroundColor: entry.color, width: '10px', height: entry.type === 'line' ? '2px' : '10px', display: 'inline-block' }}></span>
                <span>{name}</span>
            </div>
          );
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

const CustomTooltip = ({ active, payload, label, pricePrecision, amountPrecision }: any) => {
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
          <hr className="my-1 border-border" />
          {isValidNumber(dataPoint.sma10) && <p style={{color: CHART_COLORS.sma10}}>SMA10: <span className="font-mono">{dataPoint.sma10.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma20) && <p style={{color: CHART_COLORS.sma20}}>SMA20: <span className="font-mono">{dataPoint.sma20.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma50) && <p style={{color: CHART_COLORS.sma50}}>SMA50: <span className="font-mono">{dataPoint.sma50.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.rsi) && <p style={{color: CHART_COLORS.rsi}}>RSI: <span className="font-mono">{dataPoint.rsi.toFixed(2)}</span></p>}
          {isValidNumber(dataPoint.macdLine) && <p style={{color: CHART_COLORS.macdLine}}>MACD: <span className="font-mono">{dataPoint.macdLine.toFixed(4)}</span></p>}
          {isValidNumber(dataPoint.signalLine) && <p style={{color: CHART_COLORS.signalLine}}>Signal: <span className="font-mono">{dataPoint.signalLine.toFixed(4)}</span></p>}
        </div>
      );
    }
    return null;
};
  
export const MarketChart: React.FC<MarketChartProps> = ({ data, selectedMarket, strategyLogs }) => {
    const pricePrecision = selectedMarket?.pricePrecision || 2;
    const amountPrecision = selectedMarket?.precision.amount || 2;

    const cleanedData = useMemo(() => {
        return data.filter(dp => 
            dp && typeof dp === 'object' && isValidNumber(dp.timestamp) && isValidNumber(dp.closePrice)
        );
    }, [data]);

    const domains = useMemo(() => {
        if (cleanedData.length === 0) return { price: ['auto', 'auto'], rsi: [0, 100], macd: ['auto', 'auto'] };
        
        const priceValues = cleanedData.flatMap(d => [d.highPrice, d.lowPrice, d.sma10, d.sma20, d.sma50, d.upperBollingerBand, d.lowerBollingerBand]).filter(isValidNumber);
        const macdValues = cleanedData.flatMap(d => [d.macdLine, d.signalLine, d.macdHistogram]).filter(isValidNumber);

        const priceMin = Math.min(...priceValues);
        const priceMax = Math.max(...priceValues);
        const priceMargin = (priceMax - priceMin) * 0.1;

        const macdMin = Math.min(...macdValues);
        const macdMax = Math.max(...macdValues);
        const macdMargin = (macdMax - macdMin) * 0.1;

        return {
            price: [priceMin - priceMargin, priceMax + priceMargin],
            rsi: [0, 100],
            macd: [macdMin - macdMargin, macdMax + macdMargin]
        };
    }, [cleanedData]);
    
    const renderStrategyReferenceAreas = () => {
        const areas = [];
        if (cleanedData.length < 2) return null;
    
        for (let i = 1; i < cleanedData.length; i++) {
            const start = cleanedData[i-1];
            const end = cleanedData[i];
            let fill = 'transparent';
    
            if ((end.buyConditionsMet || 0) >= 2) fill = CHART_COLORS.buyZoneStrong;
            else if ((end.buyConditionsMet || 0) === 1) fill = CHART_COLORS.buyZoneWeak;
            else if ((end.sellConditionsMet || 0) >= 2) fill = CHART_COLORS.sellZoneStrong; // Suponiendo que 2+ condiciones de venta es "fuerte"
            else if ((end.sellConditionsMet || 0) === 1) fill = CHART_COLORS.sellZoneWeak;
            
            if (fill !== 'transparent') {
                areas.push(
                    <ReferenceArea key={`strat-area-${end.timestamp}`} x1={start.timestamp} x2={end.timestamp} yAxisId="priceAxis" fill={fill} stroke="none" ifOverflow="hidden" />
                );
            }
        }
        return areas;
      };

    if (cleanedData.length === 0) {
        return <div className="flex items-center justify-center h-[600px] text-muted-foreground">Cargando datos de mercado...</div>;
    }

    return (
        <div style={{ width: '100%', height: '600px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cleanedData} margin={{ top: 20, right: 60, left: 60, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.priceUp} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={CHART_COLORS.priceUp} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                    dataKey="timestamp" 
                    type="number" 
                    scale="time" 
                    domain={['dataMin', 'dataMax']} 
                    tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                    minTickGap={50} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />

                <YAxis yAxisId="priceAxis" orientation="right" domain={domains.price} tickFormatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: pricePrecision, maximumFractionDigits: pricePrecision})}`} width={80} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis yAxisId="rsiAxis" orientation="left" domain={domains.rsi} ticks={[0, 30, 70, 100]} tickFormatter={(value) => value.toString()} width={40} tick={{ fill: CHART_COLORS.rsi, fontSize: 10 }} />
                <YAxis yAxisId="macdAxis" orientation="left" domain={domains.macd} hide={true} />

                <Tooltip content={<CustomTooltip pricePrecision={pricePrecision} amountPrecision={amountPrecision} />} />
                <Legend content={<CustomLegend />} verticalAlign="top" wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }} />

                {renderStrategyReferenceAreas()}
                
                {/* --- Elementos ligados al EJE DE PRECIO (Derecha) --- */}
                <Area type="monotone" dataKey="closePrice" yAxisId="priceAxis" stroke={CHART_COLORS.priceUp} fillOpacity={1} fill="url(#colorPrice)" name="Precio" />
                
                <Line yAxisId="priceAxis" type="monotone" dataKey="sma10" stroke={CHART_COLORS.sma10} strokeWidth={2} dot={false} name="SMA 10" />
                <Line yAxisId="priceAxis" type="monotone" dataKey="sma20" stroke={CHART_COLORS.sma20} strokeWidth={2} dot={false} name="SMA 20" />
                <Line yAxisId="priceAxis" type="monotone" dataKey="sma50" stroke={CHART_COLORS.sma50} strokeWidth={2} dot={false} name="SMA 50" />
                
                <Area yAxisId="priceAxis" type="monotone" dataKey="upperBollingerBand" stroke={CHART_COLORS.bollingerBands} fill={CHART_COLORS.bollingerBands} name="Bandas Bollinger" strokeDasharray="3 3" />
                <Area yAxisId="priceAxis" type="monotone" dataKey="lowerBollingerBand" stroke={CHART_COLORS.bollingerBands} fill={CHART_COLORS.bollingerBands} hide={true} />


                {/* --- Elementos ligados a otros EJES (Izquierda) --- */}
                
                <Line yAxisId="rsiAxis" type="monotone" dataKey="rsi" stroke={CHART_COLORS.rsi} strokeWidth={1.5} dot={false} name="RSI" />
                <ReferenceLine yAxisId="rsiAxis" y={70} label={{ value: "Sobrecompra", position: "insideTopLeft", fill: "hsl(var(--destructive))", fontSize: 10 }} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <ReferenceLine yAxisId="rsiAxis" y={30} label={{ value: "Sobreventa", position: "insideBottomLeft", fill: "hsl(var(--chart-1))", fontSize: 10 }} stroke="hsl(var(--chart-1))" strokeDasharray="3 3" />
                
                <Line yAxisId="macdAxis" type="monotone" dataKey="macdLine" stroke={CHART_COLORS.macdLine} strokeWidth={1.5} dot={false} name="MACD" />
                <Line yAxisId="macdAxis" type="monotone" dataKey="signalLine" stroke={CHART_COLORS.signalLine} strokeWidth={1.5} dot={false} name="Signal" />
                <Bar yAxisId="macdAxis" dataKey="macdHistogram" barSize={4} name="MACD Hist.">
                    {cleanedData.map((entry, index) => (
                        <Cell key={`cell-macd-${index}`} fill={entry.macdHistogram && entry.macdHistogram > 0 ? CHART_COLORS.macdHistogramUp : CHART_COLORS.macdHistogramDown} />
                    ))}
                </Bar>
                
                {strategyLogs.filter(log => log.details?.action === 'buy' || log.details?.action === 'sell').map((log, index) => (
                    <ReferenceLine
                        key={`signal-line-${index}`}
                        yAxisId="priceAxis"
                        x={log.timestamp}
                        stroke={log.details?.action === 'buy' ? CHART_COLORS.signalBuyLine : CHART_COLORS.signalSellLine}
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        label={{ value: log.details?.action?.toUpperCase(), position: 'top', fill: log.details?.action === 'buy' ? CHART_COLORS.signalBuyLine : CHART_COLORS.signalSellLine }}
                    />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
};

    

    