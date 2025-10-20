// src/components/FinancialChart.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import { ChartCanvas, Chart } from "react-financial-charts";
import { XAxis, YAxis } from "react-financial-charts";
import { discontinuousTimeScaleProviderBuilder } from "react-financial-charts";
import { OHLCTooltip } from "react-financial-charts";
import { heikinAshi, rsi, macd, sma, bollingerBand } from "react-financial-charts";
import { CandlestickSeries, MACDSeries, RSISeries, BollingerSeries, SMASeries, BarSeries } from "react-financial-charts";
import { MarketPriceDataPoint } from '@/lib/types';

interface FinancialChartProps {
    data: MarketPriceDataPoint[];
}

const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
    const [chartWidth, setChartWidth] = useState(1200);
    const [chartRatio, setChartRatio] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            setChartWidth(window.innerWidth > 1200 ? 1200 : window.innerWidth);
            setChartRatio(window.innerWidth / 1200);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Set initial size
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!data || data.length < 2) { // Requiere al menos 2 puntos para algunos cálculos
        return <div className="flex items-center justify-center h-full text-muted-foreground">Cargando datos del gráfico...</div>;
    }

    const ha = heikinAshi();
    const rsiCalculator = rsi().options({ windowSize: 14 });
    const macdCalculator = macd().options({ fast: 12, slow: 26, signal: 9 });
    const sma10 = sma().options({ windowSize: 10 });
    const sma20 = sma().options({ windowSize: 20 });
    const sma50 = sma().options({ windowSize: 50 });
    const bb = bollingerBand().options({ windowSize: 20, multiplier: 2 });
    
    // Convertimos los timestamps a objetos Date y calculamos los indicadores
    const enrichedData = ha(rsiCalculator(macdCalculator(sma10(sma20(sma50(bb(data)))))));

    const xScaleProvider = discontinuousTimeScaleProviderBuilder().inputDateAccessor(d => new Date(d.date));
    const { data: chartData, xScale, xAccessor, displayXAccessor } = xScaleProvider(enrichedData);
    
    const start = xAccessor(chartData[chartData.length - 1]);
    const end = xAccessor(chartData[Math.max(0, chartData.length - 150)]);
    const xExtents = [start, end];

    const margin = { left: 10, right: 70, top: 20, bottom: 30 };
    const height = 700;
    const gridHeight = height - margin.top - margin.bottom;

    const barChartHeight = gridHeight * 0.15;
    const rsiChartHeight = gridHeight * 0.15;
    const macdChartHeight = gridHeight * 0.15;
    const chartHeight = gridHeight - barChartHeight - rsiChartHeight - macdChartHeight;

    const chartOrigin = (_: any, h: number) => [0, 0];
    const macdChartOrigin = (_: any, h: number) => [0, h - barChartHeight - rsiChartHeight - macdChartHeight];
    const rsiChartOrigin = (_: any, h: number) => [0, h - barChartHeight - rsiChartHeight];
    const barChartOrigin = (_: any, h: number) => [0, h - barChartHeight];


    return (
        <ChartCanvas
            height={height}
            ratio={chartRatio} // Ajusta el ratio para responsividad
            width={chartWidth} // Ancho de referencia
            margin={margin}
            data={chartData}
            displayXAccessor={displayXAccessor}
            seriesName="BTC-USD"
            xScale={xScale}
            xAccessor={xAccessor}
            xExtents={xExtents}
            className="bg-background text-foreground"
        >
            {/* Panel Principal */}
            <Chart id={1} height={chartHeight} yExtents={[d => [d.high, d.low], sma10.accessor(), sma20.accessor(), sma50.accessor(), bb.accessor()]} origin={chartOrigin}>
                <YAxis axisAt="right" orient="right" ticks={5} tickStroke="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" />
                <XAxis axisAt="bottom" orient="bottom" showTicks={false} stroke="hsl(var(--border))" />

                <CandlestickSeries 
                    fill={(d:any) => (d.close > d.open ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))")} 
                    stroke={(d:any) => (d.close > d.open ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))")}
                    wickStroke={(d:any) => (d.close > d.open ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))")}
                />
                <SMASeries yAccessor={sma10.accessor()} stroke={sma10.stroke()} />
                <SMASeries yAccessor={sma20.accessor()} stroke={sma20.stroke()} />
                <SMASeries yAccessor={sma50.accessor()} stroke={sma50.stroke()} />
                <BollingerSeries yAccessor={bb.accessor()} stroke={bb.stroke()} fill={bb.fill()} />

                <OHLCTooltip origin={[-40, 0]} textFill="hsl(var(--foreground))" labelFill="hsl(var(--primary))" />
            </Chart>
            
            {/* Panel MACD */}
            <Chart id={2} height={macdChartHeight} yExtents={macdCalculator.accessor()} origin={macdChartOrigin} padding={{ top: 10, bottom: 10 }}>
                <YAxis axisAt="right" orient="right" ticks={2} tickFormat={format(".2f")} tickStroke="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" />
                <XAxis axisAt="bottom" orient="bottom" showTicks={false} stroke="hsl(var(--border))" />
                <MACDSeries yAccessor={d => d.macd} {...macdCalculator.stroke()} fill={macdCalculator.fill()} />
            </Chart>

            {/* Panel RSI */}
            <Chart id={3} height={rsiChartHeight} yExtents={[0, 100]} origin={rsiChartOrigin} padding={{ top: 10, bottom: 10 }}>
                <YAxis axisAt="right" orient="right" tickValues={[30, 50, 70]} tickStroke="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" />
                <XAxis axisAt="bottom" orient="bottom" showTicks={false} stroke="hsl(var(--border))" />
                <RSISeries yAccessor={d => d.rsi} stroke={rsiCalculator.stroke()} />
            </Chart>
            
            {/* Panel de Volumen */}
             <Chart id={4} height={barChartHeight} yExtents={d => d.volume} origin={barChartOrigin}>
                <YAxis axisAt="right" orient="right" ticks={5} tickFormat={format(".2s")} tickStroke="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" />
                <XAxis axisAt="bottom" orient="bottom" tickFormat={timeFormat("%d-%m %H:%M")} tickStroke="hsl(var(--muted-foreground))" stroke="hsl(var(--border))" />
                <BarSeries yAccessor={(d:any) => d.volume} fill={(d:any) => (d.close > d.open ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))")} />
            </Chart>

        </ChartCanvas>
    );
};

export default FinancialChart;
