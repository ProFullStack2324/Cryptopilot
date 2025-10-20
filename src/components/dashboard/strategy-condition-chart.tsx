// src/components/dashboard/strategy-condition-chart.tsx
"use client";

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { MarketPriceDataPoint } from '@/lib/types';

interface StrategyConditionChartProps {
  data: MarketPriceDataPoint[];
}

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Colores para las condiciones
const SCALPING_BUY_COLOR = "rgba(16, 185, 129, 0.4)"; // Verde claro para scalping
const SNIPER_BUY_COLOR = "rgba(5, 150, 105, 0.8)"; // Verde oscuro para francotirador

const SCALPING_SELL_COLOR = "rgba(239, 68, 68, 0.4)"; // Rojo claro para scalping
const SNIPER_SELL_COLOR = "rgba(190, 18, 60, 0.8)"; // Rojo oscuro para francotirador

export function StrategyConditionChart({ data }: StrategyConditionChartProps) {

  const processedData = data.map((dp) => {
    // Usamos el conteo de condiciones que ya viene pre-calculado en el hook
    const buyConditionsMet = dp.buyConditionsMet || 0;
    const sellConditionsMet = dp.sellConditionsMet || 0;

    return {
      timestamp: dp.timestamp,
      scalpingBuy: buyConditionsMet >= 1 ? 1 : 0,
      sniperBuy: buyConditionsMet >= 2 ? 1 : 0, // Se apilará sobre el de scalping
      scalpingSell: sellConditionsMet >= 1 ? -1 : 0,
      sniperSell: sellConditionsMet >= 2 ? -1 : 0, // Se apilará sobre el de scalping (hacia abajo)
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const timestamp = new Date(label).toLocaleTimeString();
      const buyConditions = payload.find(p => p.dataKey === 'sniperBuy')?.payload.sniperBuy + payload.find(p => p.dataKey === 'scalpingBuy')?.payload.scalpingBuy || 0;
      const sellConditions = Math.abs(payload.find(p => p.dataKey === 'sniperSell')?.payload.sniperSell + payload.find(p => p.dataKey === 'scalpingSell')?.payload.scalpingSell || 0);

      return (
        <div className="bg-background/90 p-3 border rounded-md shadow-lg text-foreground text-xs backdrop-blur-sm">
          <p className="font-bold mb-2">Hora: {timestamp}</p>
          <div className="space-y-1">
             {buyConditions > 0 && <p className="font-semibold text-green-500">Condiciones de Compra Cumplidas: {buyConditions}</p>}
             {sellConditions > 0 && <p className="font-semibold text-red-500 mt-2">Condiciones de Venta Cumplidas: {sellConditions}</p>}
             {buyConditions === 0 && sellConditions === 0 && <p className="text-muted-foreground">Sin condiciones activas</p>}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
            <AreaChart 
                data={processedData} 
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                stackOffset="sign"
            >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
                dataKey="timestamp" 
                tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                minTickGap={60}
            />
            <YAxis 
                domain={[-3, 3]} 
                allowDecimals={false}
                tickCount={7}
                tickFormatter={(value) => `${Math.abs(value)}`}
                label={{ value: 'Nº de Condiciones', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
                verticalAlign="top"
                align="center"
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingBottom: '20px' }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
            
            <Area type="monotone" dataKey="scalpingBuy" stackId="buy" name="Señal Compra Scalping (>=1)" stroke={SCALPING_BUY_COLOR} fill={SCALPING_BUY_COLOR} />
            <Area type="monotone" dataKey="sniperBuy" stackId="buy" name="Señal Compra Francotirador (>=2)" stroke={SNIPER_BUY_COLOR} fill={SNIPER_BUY_COLOR} />

            <Area type="monotone" dataKey="scalpingSell" stackId="sell" name="Señal Venta Scalping (>=1)" stroke={SCALPING_SELL_COLOR} fill={SCALPING_SELL_COLOR} />
            <Area type="monotone" dataKey="sniperSell" stackId="sell" name="Señal Venta Francotirador (>=2)" stroke={SNIPER_SELL_COLOR} fill={SNIPER_SELL_COLOR} />

            </AreaChart>
        </ResponsiveContainer>
    </div>
  );
}

    