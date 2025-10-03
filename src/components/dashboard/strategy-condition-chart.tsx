// src/components/dashboard/strategy-condition-chart.tsx
"use client";

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from 'recharts';
import { MarketPriceDataPoint } from '@/lib/types';

interface StrategyConditionChartProps {
  data: MarketPriceDataPoint[];
}

const BUY_CONDITION_COLOR = "#22c55e"; // green-500
const SELL_CONDITION_COLOR = "#ef4444"; // red-500

export function StrategyConditionChart({ data }: StrategyConditionChartProps) {

  const processedData = data.map(dp => {
    // Definir condiciones de compra y venta según la estrategia de scalping
    const buyConditionMet = !!(dp.lowerBollingerBand && dp.rsi && dp.closePrice <= dp.lowerBollingerBand && dp.rsi <= 35);
    const sellConditionMet = !!(dp.upperBollingerBand && dp.rsi && dp.closePrice >= dp.upperBollingerBand && dp.rsi >= 65);

    return {
      timestamp: dp.timestamp,
      buyCondition: buyConditionMet ? 1 : 0,
      sellCondition: sellConditionMet ? -1 : 0,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const timestamp = new Date(label).toLocaleTimeString();
      const buyCondition = payload.find((p: any) => p.dataKey === 'buyCondition')?.value === 1;
      const sellCondition = payload.find((p: any) => p.dataKey === 'sellCondition')?.value === -1;
      
      let conditionText = "No se cumplen condiciones";
      if (buyCondition) {
        conditionText = "Condición de COMPRA cumplida";
      } else if (sellCondition) {
        conditionText = "Condición de VENTA cumplida";
      }

      return (
        <div className="bg-background/80 p-2 border rounded-md shadow-lg text-foreground text-xs">
          <p><strong>Hora:</strong> {timestamp}</p>
          <p className={`font-semibold ${buyCondition ? 'text-green-500' : sellCondition ? 'text-red-500' : ''}`}>
            {conditionText}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 150 }}>
      <ResponsiveContainer>
        <BarChart data={processedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            minTickGap={60}
          />
          <YAxis 
            domain={[-1, 1]} 
            allowDecimals={false}
            tickCount={3}
            tickFormatter={(value) => {
              if (value === 1) return 'COMPRA';
              if (value === -1) return 'VENTA';
              return 'HOLD';
            }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            formatter={(value) => {
              if (value === 'buyCondition') return <span style={{ color: BUY_CONDITION_COLOR }}>Condición de Compra</span>;
              if (value === 'sellCondition') return <span style={{ color: SELL_CONDITION_COLOR }}>Condición de Venta</span>;
              return value;
            }}
          />
          <Bar dataKey="buyCondition" name="buyCondition" barSize={5}>
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.buyCondition ? BUY_CONDITION_COLOR : 'transparent'} />
            ))}
          </Bar>
          <Bar dataKey="sellCondition" name="sellCondition" barSize={5}>
            {processedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.sellCondition ? SELL_CONDITION_COLOR : 'transparent'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
