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
  CartesianGrid // Rejilla de fondo para el gráfico
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
  macdLine: '#3b82f6', // blue-500 (azul)
  signalLine: '#ef4444', // red-500 (rojo)
  macdHistogramPositive: '#10b981', // emerald-500 (verde esmeralda)
  macdHistogramNegative: '#ef4444', // red-500 (rojo)
  rsi: '#a855f7', // purple-500 (púrpura)
  priceLine: '#6b7280', // gray-500
  crossoverBuy: '#22c55e', // green-500 (verde para cruces alcistas)
  crossoverSell: '#dc2626', // red-600 (rojo para cruces bajistas)
  highlightArea: 'rgba(255, 255, 0, 0.25)', // Amarillo semitransparente para resaltar
  volumeSMA: '#cbd5e1', // slate-300 (gris azulado para SMA de volumen)
  signalBuy: '#10b981', // emerald-500 (señales de compra)
  signalSell: '#ef4444', // red-500 (señales de venta)
  signalHold: '#facc15', // yellow-400 (señales de hold)
};

// Items para la leyenda del gráfico, con sus tipos y colores asociados
export const getChartLegendItems = (colors: typeof CHART_COLORS) => [
  { value: 'Velas Japonesas', type: 'rect', color: '#16a34a', id: 'candles' },
  { value: 'SMA10', type: 'line', color: colors.sma10, id: 'sma10' },
  { value: 'SMA20', type: 'line', color: colors.sma20, id: 'sma20' },
  { value: 'Volumen', type: 'area', color: '#8884d8', id: 'volume' },
  { value: 'Volumen SMA20', type: 'line', color: colors.volumeSMA, id: 'volumeSMA20' },
  { value: 'RSI', type: 'line', color: colors.rsi, id: 'rsi' },
  { value: 'MACD Line', type: 'line', color: colors.macdLine, id: 'macdLine' },
  { value: 'Signal Line', type: 'line', color: colors.signalLine, id: 'signalLine' },
  { value: 'MACD Histograma (+)', type: 'rect', color: colors.macdHistogramPositive, id: 'macdHistPositive' },
  { value: 'MACD Histograma (-)', type: 'rect', color: colors.macdHistogramNegative, id: 'macdHistNegative' },
  { value: 'Cruce SMA (Compra)', type: 'dot', color: colors.crossoverBuy, id: 'smaCrossoverBuy' },
  { value: 'Cruce SMA (Venta)', type: 'dot', color: colors.crossoverSell, id: 'smaCrossoverSell' },
  { value: 'Cruce MACD (Compra)', type: 'dot', color: colors.crossoverBuy, id: 'macdCrossoverBuy' },
  { value: 'Cruce MACD (Venta)', type: 'dot', color: colors.crossoverSell, id: 'macdCrossoverSell' },
  { value: 'Señal de Compra', type: 'dot', color: colors.signalBuy, id: 'signalBuy' },
  { value: 'Señal de Venta', type: 'dot', color: colors.signalSell, id: 'signalSell' },
  { value: 'Señal de Hold', type: 'dot', color: colors.signalHold, id: 'signalHold' },
  { value: 'Zona de Estrategia', type: 'rect', color: colors.highlightArea, id: 'strategyZone' },
  { value: 'RSI > 70 (Sobrecompra)', type: 'dot', color: colors.crossoverSell, id: 'rsiOverbought' },
  { value: 'RSI < 30 (Sobreventa)', type: 'dot', color: colors.crossoverBuy, id: 'rsiOversold' },
];

// Componente principal del gráfico de mercado
export const MarketChart: React.FC<MarketChartProps> = ({ data, selectedMarket, strategyLogs, chartColors }) => {
  // Determina la precisión decimal para precios y cantidades
  const pricePrecision = selectedMarket?.pricePrecision || 2;
  const amountPrecision = selectedMarket?.precision.amount || 2;

  // Estado para controlar el montaje y asegurar que ResponsiveContainer renderice correctamente
  // Recharts a veces requiere un montaje tardío para calcular dimensiones.
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para montar el gráfico después de un pequeño retraso
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    return () => clearTimeout(timer); // Limpieza del temporizador al desmontar
  }, []);

  // Mapea los logs de estrategia a un formato más accesible por timestamp
  // Permite acceso rápido a la acción de una señal para un timestamp dado
  const strategySignalsMap = useMemo(() => {
    const map = new Map<number, 'buy' | 'sell' | 'hold'>();
    strategyLogs.forEach(log => {
      // Verifica que el timestamp sea un número válido y que la acción sea una de las esperadas
      if (isValidNumber(log.timestamp) && log.details?.action && ['buy', 'sell', 'hold'].includes(log.details.action)) {
        map.set(log.timestamp, log.details.action as 'buy' | 'sell' | 'hold'); // Aserción de tipo segura aquí
      }
    });
    return map;
  }, [strategyLogs]); // Se recalcula si `strategyLogs` cambia

  // Limpia y prepara los datos del gráfico
  // Filtra puntos de datos incompletos y calcula la SMA de volumen, RSI y MACD
  const cleanedData = useMemo(() => {
    return data.filter(dp =>
      // Asegura que cada punto de datos y sus propiedades clave son válidos y numéricos
      dp && typeof dp === 'object' &&
      isValidNumber(dp.timestamp) &&
      isValidNumber(dp.openPrice) &&
      isValidNumber(dp.highPrice) &&
      isValidNumber(dp.lowPrice) &&
      isValidNumber(dp.closePrice)
    ).map((dp, index, arr) => {
      let volumeSMA20 = null;
      // Calcula la SMA de 20 periodos para el volumen si hay suficientes datos previos
      if (index >= 19) {
        const relevantVolumes = arr.slice(index - 19, index + 1).map(d => d.volume);
        volumeSMA20 = calculateSMA(relevantVolumes as number[], 20); // Aseguramos que `relevantVolumes` es `number[]`
      }
      return {
        ...dp,
        volumeSMA20: volumeSMA20 // Añade la SMA de volumen al punto de datos
      };
    });
  }, [data]); // Se recalcula si los datos brutos cambian

  // Si no hay datos limpios, muestra un mensaje
  if (cleanedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No hay suficientes datos históricos para mostrar el gráfico.
      </div>
    );
  }

  // Obtiene el último punto de datos disponible para ReferenceDot del RSI
  const latestDataPoint = cleanedData.length > 0 ? cleanedData[cleanedData.length - 1] : null;

  // Calcula los puntos de cruce para SMAs y MACD para ReferenceDot
  const crossoverPoints = useMemo(() => {
    const points: { timestamp: number; type: 'smaBuy' | 'smaSell' | 'macdBuy' | 'macdSell'; value: number }[] = [];

    for (let i = 1; i < cleanedData.length; i++) {
      const prev = cleanedData[i - 1];
      const curr = cleanedData[i];

      // Cruce SMA (SMA10 vs SMA20)
      // Aseguramos que las propiedades son números válidos antes de comparar
      if (
        isValidNumber(prev?.sma10) && isValidNumber(prev?.sma20) &&
        isValidNumber(curr.sma10) && isValidNumber(curr.sma20)
      ) {
        if (prev.sma10 <= prev.sma20 && curr.sma10 > curr.sma20) {
          points.push({ timestamp: curr.timestamp, type: 'smaBuy', value: curr.closePrice });
        }
        if (prev.sma10 >= prev.sma20 && curr.sma10 < curr.sma20) {
          points.push({ timestamp: curr.timestamp, type: 'smaSell', value: curr.closePrice });
        }
      }

      // Cruce MACD (MACD Line vs Signal Line)
      // CORRECCIÓN: Aseguramos que curr.signalLine se valida correctamente aquí.
      if (
        isValidNumber(prev?.macdLine) && isValidNumber(prev?.signalLine) &&
        isValidNumber(curr.macdLine) && isValidNumber(curr.signalLine)
      ) {
        if (prev.macdLine <= prev.signalLine && curr.macdLine > curr.signalLine) {
          points.push({ timestamp: curr.timestamp, type: 'macdBuy', value: curr.macdLine });
        }
        if (prev.macdLine >= prev.signalLine && curr.macdLine < curr.signalLine) {
          points.push({ timestamp: curr.timestamp, type: 'macdSell', value: curr.macdLine });
        }
      }
    }
    return points;
  }, [cleanedData]); // Se recalcula si `cleanedData` cambia

  // CustomTooltip: Componente de tooltip personalizado para mostrar información detallada
  const CustomTooltip = ({ active, payload, label }: any) => {
    // Solo renderiza si el tooltip está activo y hay datos
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload; // El objeto de datos completo para el punto actual
      const signal = strategySignalsMap.get(dataPoint.timestamp); // Obtiene la señal de estrategia si existe

      return (
        <div className="bg-gray-800 bg-opacity-90 p-3 rounded-md shadow-lg text-white text-xs space-y-1 border border-gray-700">
          <p className="font-bold">Hora: {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          {/* Muestra los precios de apertura, máximo, mínimo y cierre */}
          <p>Open: <span className="font-mono">{isValidNumber(dataPoint.openPrice) ? dataPoint.openPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>High: <span className="font-mono">{isValidNumber(dataPoint.highPrice) ? dataPoint.highPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Low: <span className="font-mono">{isValidNumber(dataPoint.lowPrice) ? dataPoint.lowPrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          <p>Close: <span className="font-mono">{isValidNumber(dataPoint.closePrice) ? dataPoint.closePrice.toFixed(pricePrecision) : 'N/A'}</span></p>
          {/* Muestra el volumen y su SMA si están disponibles */}
          <p>Volume: <span className="font-mono">{isValidNumber(dataPoint.volume) ? dataPoint.volume.toFixed(amountPrecision) : 'N/A'}</span></p>
          {isValidNumber(dataPoint.volumeSMA20) && <p>Vol SMA20: <span className="font-mono">{dataPoint.volumeSMA20.toFixed(amountPrecision)}</span></p>}
          {/* Muestra los valores de los indicadores si están disponibles */}
          {isValidNumber(dataPoint.sma10) && <p>SMA10: <span className="font-mono">{dataPoint.sma10.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.sma20) && <p>SMA20: <span className="font-mono">{dataPoint.sma20.toFixed(pricePrecision)}</span></p>}
          {isValidNumber(dataPoint.macdLine) && <p>MACD Line: <span className="font-mono">{dataPoint.macdLine.toFixed(4)}</span></p>}
          {isValidNumber(dataPoint.signalLine) && <p>Signal Line: <span className="font-mono">{dataPoint.signalLine.toFixed(4)}</span></p>}
          {isValidNumber(dataPoint.macdHistogram) && <p>MACD Hist: <span className="font-mono">{dataPoint.macdHistogram.toFixed(4)}</span></p>}
          {isValidNumber(dataPoint.rsi) && <p>RSI: <span className="font-mono">{dataPoint.rsi.toFixed(2)}</span></p>}
          {/* Muestra la señal de estrategia si existe */}
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

  // CustomCandleShape: Función para dibujar las velas japonesas.
  // Esta función se pasa al prop 'shape' de un componente <Scatter>.
  // Recibe 'cx', 'cy' (coordenadas del centro del punto) y 'payload' (los datos del punto).
  const CustomCandleShape = (props: any): ReactElement<SVGElement> => {
    // 1. Desestructurar las props. Recharts pasa 'props' como 'any' o 'unknown'.
    const { cx, cy, payload } = props;

    // 2. Aplicar aserciones de tipo y guardias de tipo robustas.
    // Esto asegura a TypeScript (tiempo de compilación) y al runtime (tiempo de ejecución)
    // que las variables que usaremos son números válidos.
    // Si alguna es inválida, se retorna un elemento SVG transparente para evitar errores.
    if (
      !isValidNumber(cx) ||
      !isValidNumber(cy) ||
      !payload || typeof payload !== 'object' ||
      !isValidNumber(payload.openPrice) ||
      !isValidNumber(payload.closePrice) ||
      !isValidNumber(payload.highPrice) ||
      !isValidNumber(payload.lowPrice)
    ) {
      return <g />; // Retorna un grupo SVG vacío si los datos no son válidos
    }

    // Ahora, sabemos que todas estas variables son números válidos.
    const { openPrice, closePrice, highPrice, lowPrice } = payload;
    const isBullish = closePrice >= openPrice; // Determina si la vela es alcista
    const color = isBullish ? '#16a34a' : '#dc2626'; // Verde para alcista, rojo para bajista

    const candleBodyWidth = 4; // Ancho fijo del cuerpo de la vela en píxeles (ajustable)

    // Calculamos el rango de precios de la vela (High - Low) y aseguramos un mínimo para evitar división por cero
    const priceRange = Math.max(Math.abs(highPrice - lowPrice), 0.0001);

    // Determinamos la escala de píxeles por unidad de precio.
    // Asumimos un tamaño de vela vertical máximo (ej. 50 píxeles) para una visualización consistente.
    // Este valor puede ser ajustado para hacer las velas más altas o más cortas.
    const maxPixelHeightForRange = 50; // Valor arbitrario, ajustar según necesidad
    const pixelPerPriceUnit = maxPixelHeightForRange / priceRange;

    // Calculamos las coordenadas Y para la apertura, máximo, mínimo y cierre de la vela.
    // Estas son relativas a 'cy', que es el punto central Y de la vela proporcionado por Scatter.
    // La conversión de precio a píxeles se hace usando 'pixelPerPriceUnit'.
    const openY = cy - (openPrice - closePrice) * pixelPerPriceUnit;
    const highY = cy - (highPrice - closePrice) * pixelPerPriceUnit;
    const lowY = cy - (lowPrice - closePrice) * pixelPerPriceUnit;

    // Calculamos la posición y altura del cuerpo de la vela.
    const bodyTop = Math.min(openY, cy); // El punto Y superior del cuerpo
    const bodyBottom = Math.max(openY, cy); // El punto Y inferior del cuerpo
    const bodyHeight = Math.abs(openY - cy) || 1; // Altura del cuerpo, mínimo 1px para dojis

    // Retornamos los elementos SVG para dibujar la vela
    return (
      <g>
        {/* Mecha superior (desde High hasta el cuerpo) */}
        <line
          x1={cx} y1={highY}
          x2={cx} y2={bodyTop}
          stroke={color}
          strokeWidth={1}
        />
        {/* Mecha inferior (desde el cuerpo hasta Low) */}
        <line
          x1={cx} y1={bodyBottom}
          x2={cx} y2={lowY}
          stroke={color}
          strokeWidth={1}
        />
        {/* Cuerpo de la vela (rectángulo) */}
        <rect
          x={cx - candleBodyWidth / 2} // Centra el cuerpo horizontalmente
          y={bodyTop}
          width={candleBodyWidth}
          height={bodyHeight}
          fill={color}
          stroke={color}
        />
      </g>
    );
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* ==================================== Gráfico Unificado de Scalping ==================================== */}
      {/* Contenedor principal del gráfico con altura fija */}
      <div style={{ width: '100%', height: '500px' }}> {/* Altura ajustada para acomodar todos los indicadores */}
        {isMounted && <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={cleanedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
          >
            {/* Rejilla cartesiana del gráfico */}
            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />

            {/* Eje X (Tiempo): Visible y con formato de hora */}
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              minTickGap={50}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={{ stroke: '#4b5563' }}
            />

            {/* Tooltip personalizado para mostrar información detallada */}
            <Tooltip content={<CustomTooltip />} />
            {/* Leyenda del gráfico para identificar las series de datos */}
            <Legend wrapperStyle={{ position: 'relative', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingTop: '10px' }} />

            {/* Eje Y principal para el Precio (VISIBLE): Orientado a la derecha */}
            <YAxis
              orientation="right"
              dataKey="closePrice"
              domain={['auto', 'auto']}
              tickFormatter={(value) => isValidNumber(value) ? value.toFixed(pricePrecision) : ''}
              width={80}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={{ stroke: '#4b5563' }}
              mirror={false}
              yAxisId="priceAxis"
            />

            {/* Eje Y para el Volumen (OCULTO): Se utiliza para escalar el volumen correctamente */}
            <YAxis
              orientation="left"
              dataKey="volume"
              domain={[0, 'auto']}
              tickFormatter={(value) => isValidNumber(value) ? value.toFixed(amountPrecision) : ''}
              width={0} /* Ancho cero para ocultarlo */
              hide={true} /* Oculta completamente el eje */
              yAxisId="volumeAxis"
            />

            {/* Eje Y para RSI (OCULTO): Se utiliza para escalar el RSI correctamente (0-100) */}
            <YAxis
              orientation="left"
              domain={[0, 100]}
              width={0} /* Ancho cero para ocultarlo */
              hide={true} /* Oculta completamente el eje */
              yAxisId="rsiAxis"
            />

            {/* Eje Y para MACD (OCULTO): Se utiliza para escalar el MACD correctamente */}
            <YAxis
              orientation="left"
              domain={['auto', 'auto']} /* Escala automática para MACD */
              width={0} /* Ancho cero para ocultarlo */
              hide={true} /* Oculta completamente el eje */
              yAxisId="macdAxis"
            />

            {/* Área de referencia para resaltar las últimas 3 velas (zona de estrategia) */}
            {cleanedData.length >= 3 && (
                <ReferenceArea
                    x1={cleanedData[cleanedData.length - 3].timestamp}
                    x2={cleanedData[cleanedData.length - 1].timestamp}
                    yAxisId="priceAxis"
                    fill={chartColors.highlightArea}
                    stroke="rgba(255, 255, 0, 0.6)"
                    strokeDasharray="3 3"
                    label={{ value: "Últimas 3 Velas (Estrategia)", position: "top", fill: "#facc15", fontSize: 10 }}
                    name="Zona de Estrategia"
                />
            )}

            {/* Velas Japonesas usando Scatter con CustomCandleShape */}
            <Scatter
              data={cleanedData}
              x="timestamp"
              y="closePrice" /* Scatter mapea el dataKey al eje Y. CustomCandleShape usa cx, cy y payload. */
              yAxisId="priceAxis"
              name="Velas Japonesas"
              shape={CustomCandleShape} /* Pasa la función de forma personalizada para dibujar las velas */
              isAnimationActive={false} /* Deshabilita animaciones para un mejor rendimiento */
            />

            {/* Líneas de Media Móvil Simple (SMA10, SMA20) */}
            <Line yAxisId="priceAxis" type="monotone" dataKey="sma10" stroke={chartColors.sma10} dot={false} strokeWidth={2.5} name="SMA10" />
            <Line yAxisId="priceAxis" type="monotone" dataKey="sma20" stroke={chartColors.sma20} dot={false} strokeWidth={2.5} name="SMA20" />

            {/* VISUALIZACIÓN DE CRUCES SMA como ReferenceDot */}
            {crossoverPoints.filter(p => p.type.startsWith('sma')).map((point, index) => (
                <ReferenceDot
                    key={`sma-crossover-${index}-${point.timestamp}`}
                    x={point.timestamp}
                    y={point.value}
                    yAxisId="priceAxis"
                    r={8}
                    fill={point.type === 'smaBuy' ? chartColors.crossoverBuy : chartColors.crossoverSell}
                    stroke={point.type === 'smaBuy' ? chartColors.crossoverBuy : chartColors.crossoverSell}
                    strokeWidth={2}
                    /* Función content con validación de x e y para el label */
                    label={{
                      value: point.type === 'smaBuy' ? '▲ SMA' : '▼ SMA',
                      position: 'top',
                      fontSize: 10,
                      fill: '#fff',
                      fontWeight: 'bold',
                      /* 'content' es una función de renderizado para el label.
                         Sus props (x, y) pueden ser 'undefined' si no hay espacio o son inválidos. */
                      content: (props: any) => {
                         const { value, x, y } = props;
                         /* Aseguramos que x e y son números antes de operar aritméticamente */
                         if (!isValidNumber(x) || !isValidNumber(y)) {
                             return null; /* Retorna null si las coordenadas no son válidas */
                         }
                         return (
                            <g>
                              {/* Dibuja el texto del label ajustando la posición Y */}
                              <text x={x} y={y - 10} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">{value}</text>
                            </g>
                          );
                       }
                    }}
                    name={point.type === 'smaBuy' ? "Cruce SMA (Compra)" : "Cruce SMA (Venta)"}
                />
            ))}

            {/* Puntos de Señal de Estrategia (BUY/SELL/HOLD) como ReferenceDot */}
            {/* Iteramos sobre los datos limpios para encontrar las señales y dibujarlas como ReferenceDots */}
            {cleanedData.map((entry) => {
                const signal = strategySignalsMap.get(entry.timestamp);
                if (signal === 'buy') {
                    return (
                        <ReferenceDot
                            key={`buy-${entry.timestamp}`}
                            x={entry.timestamp}
                            /* Posiciona la señal de compra 1% debajo del precio mínimo de la vela */
                            y={isValidNumber(entry.lowPrice) ? entry.lowPrice * 0.99 : 0}
                            yAxisId="priceAxis"
                            r={15} /* Radio de la señal */
                            fill={chartColors.signalBuy}
                            stroke={chartColors.signalBuy}
                            strokeWidth={4}
                            label={{ value: 'COMPRA', position: 'insideBottom', fontSize: 15, fill: '#fff', fontWeight: 'bold' }}
                            name="Señal de Compra"
                        />
                    );
                }
                if (signal === 'sell') {
                    return (
                        <ReferenceDot
                            key={`sell-${entry.timestamp}`}
                            x={entry.timestamp}
                            /* Posiciona la señal de venta 1% encima del precio máximo de la vela */
                            y={isValidNumber(entry.highPrice) ? entry.highPrice * 1.01 : 0}
                            yAxisId="priceAxis"
                            r={15} /* Radio de la señal */
                            fill={chartColors.signalSell}
                            stroke={chartColors.signalSell}
                            strokeWidth={4}
                            label={{ value: 'VENTA', position: 'insideTop', fontSize: 15, fill: '#fff', fontWeight: 'bold' }}
                            name="Señal de Venta"
                        />
                    );
                }
                if (signal === 'hold') {
                    return (
                        <ReferenceDot
                            key={`hold-${entry.timestamp}`}
                            x={entry.timestamp}
                            /* Posiciona la señal de hold en el precio de cierre */
                            y={isValidNumber(entry.closePrice) ? entry.closePrice : 0}
                            yAxisId="priceAxis"
                            r={12} /* Radio de la señal */
                            fill={chartColors.signalHold}
                            stroke={chartColors.signalHold}
                            strokeWidth={3}
                            label={{ value: 'HOLD', position: 'middle', fontSize: 12, fill: '#333', fontWeight: 'bold' }}
                            name="Señal de Hold"
                        />
                    );
                }
                return null; /* No dibuja nada si no hay señal o es inválida */
            })}

            {/* Volumen (como barras) - ahora en el mismo ComposedChart, usando su propio Y-Axis oculto */}
            <Bar
              yAxisId="volumeAxis" /* Asigna al eje Y de volumen oculto */
              dataKey="volume"
              barSize={2} /* Tamaño de barra muy pequeño para que se vea como una línea de fondo */
              fill="#8884d8" /* Color de relleno */
              name="Volumen"
              opacity={0.2} /* Opacidad reducida para no competir con el precio */
            />
            {/* Línea de SMA de 20 periodos para el volumen - también en el ComposedChart */}
            <Line yAxisId="volumeAxis" type="monotone" dataKey="volumeSMA20" stroke={chartColors.volumeSMA} dot={false} strokeWidth={1} opacity={0.3} name="Volumen SMA20" />


            {/* Línea del RSI - en el mismo ComposedChart, usando su propio Y-Axis oculto */}
            <Line yAxisId="rsiAxis" type="monotone" dataKey="rsi" stroke={chartColors.rsi} dot={false} strokeWidth={1.5} name="RSI" />
            {/* Puntos de referencia para niveles de sobrecompra (RSI > 70) y sobreventa (RSI < 30) */}
            {latestDataPoint && isValidNumber(latestDataPoint.rsi) && (
              <>
                {latestDataPoint.rsi > 70 && (
                    <ReferenceDot
                        x={latestDataPoint.timestamp}
                        y={70}
                        r={6}
                        fill={chartColors.crossoverSell}
                        stroke={chartColors.crossoverSell}
                        yAxisId="rsiAxis" /* Asigna al eje Y de RSI oculto */
                        name="RSI > 70 (Sobrecompra)"
                        label={{ value: "SOBRECOMPRA", position: "top", fontSize: 10, fill: chartColors.crossoverSell, fontWeight: 'bold' }}
                    />
                )}
                {latestDataPoint.rsi < 30 && (
                    <ReferenceDot
                        x={latestDataPoint.timestamp}
                        y={30}
                        r={6}
                        fill={chartColors.crossoverBuy}
                        stroke={chartColors.crossoverBuy}
                        yAxisId="rsiAxis" /* Asigna al eje Y de RSI oculto */
                        name="RSI < 30 (Sobreventa)"
                        label={{ value: "SOBREVENTA", position: "bottom", fontSize: 10, fill: chartColors.crossoverBuy, fontWeight: 'bold' }}
                    />
                )}
              </>
            )}

            {/* Líneas MACD y Signal - en el mismo ComposedChart, usando su propio Y-Axis oculto */}
            <Line yAxisId="macdAxis" type="monotone" dataKey="macdLine" stroke={chartColors.macdLine} dot={false} strokeWidth={1.5} name="MACD Line" />
            <Line yAxisId="macdAxis" type="monotone" dataKey="signalLine" stroke={chartColors.signalLine} dot={false} strokeWidth={1.5} name="Signal Line" />
            {/* Histograma MACD: Usando Bar con Cell para coloreado dinámico */}
            <Bar
                yAxisId="macdAxis" /* Asigna al eje Y de MACD oculto */
                dataKey="macdHistogram"
                isAnimationActive={false}
                name="MACD Histograma"
                barSize={2} /* Tamaño de barra muy pequeño */
            >
                {/* Asigna color a cada barra del histograma (positivo/negativo) */}
                {cleanedData.map((entry, index) => (
                    <Cell
                      key={`macd-hist-cell-${index}`}
                      fill={isValidNumber(entry.macdHistogram) && entry.macdHistogram >= 0 ? chartColors.macdHistogramPositive : chartColors.macdHistogramNegative}
                    />
                  ))}
            </Bar>
            {/* VISUALIZACIÓN DE CRUCES MACD como ReferenceDot */}
            {crossoverPoints.filter(p => p.type.startsWith('macd')).map((point, index) => (
                <ReferenceDot
                    key={`macd-crossover-${index}-${point.timestamp}`}
                    x={point.timestamp}
                    y={point.value}
                    yAxisId="macdAxis" /* Asigna al eje Y de MACD oculto */
                    r={6}
                    fill={point.type === 'macdBuy' ? chartColors.crossoverBuy : chartColors.crossoverSell}
                    stroke={point.type === 'macdBuy' ? chartColors.crossoverBuy : chartColors.crossoverSell}
                    strokeWidth={2}
                    /* Label para los cruces MACD. */
                    label={{ value: point.type === 'macdBuy' ? '▲ MACD' : '▼ MACD', position: 'top', fontSize: 10, fill: '#fff', fontWeight: 'bold' }}
                    name={point.type === 'macdBuy' ? "Cruce MACD (Compra)" : "Cruce MACD (Venta)"}
                />
            ))}
          </ComposedChart>
        </ResponsiveContainer>}
      </div>
    </div>
  );
};