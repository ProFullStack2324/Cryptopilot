// src/components/dashboard/strategy-condition-chart.tsx
"use client";

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { MarketPriceDataPoint } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface StrategyConditionChartProps {
  data: MarketPriceDataPoint[];
}

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Colores más distintivos para cada condición
const BUY_CONDITION_PRICE_COLOR = "rgba(16, 185, 129, 0.7)"; // emerald-500
const BUY_CONDITION_RSI_COLOR = "rgba(52, 211, 153, 0.7)"; // emerald-400
const BUY_CONDITION_MACD_COLOR = "rgba(110, 231, 183, 0.7)"; // emerald-300

const SELL_CONDITION_PRICE_COLOR = "rgba(239, 68, 68, 0.7)"; // red-500
const SELL_CONDITION_RSI_COLOR = "rgba(248, 113, 113, 0.7)"; // red-400

export function StrategyConditionChart({ data }: StrategyConditionChartProps) {

  const processedData = data.map((dp, index) => {
    if (index === 0) return { timestamp: dp.timestamp };
    const prev = data[index - 1];

    // --- Condiciones de Compra ---
    const priceBuyMet = isValidNumber(dp.closePrice) && isValidNumber(dp.lowerBollingerBand) && dp.closePrice <= dp.lowerBollingerBand;
    const rsiBuyMet = isValidNumber(dp.rsi) && dp.rsi <= 35;
    const macdBuyMet = isValidNumber(dp.macdHistogram) && isValidNumber(prev.macdHistogram) && dp.macdHistogram > 0 && prev.macdHistogram <= 0;

    // --- Condiciones de Venta ---
    const priceSellMet = isValidNumber(dp.closePrice) && isValidNumber(dp.upperBollingerBand) && dp.closePrice >= dp.upperBollingerBand;
    const rsiSellMet = isValidNumber(dp.rsi) && dp.rsi >= 65;

    return {
      timestamp: dp.timestamp,
      // Asigna 1 si la condición se cumple, 0 si no. La altura total mostrará cuántas se cumplen.
      buyPriceCondition: priceBuyMet ? 1 : 0,
      buyRsiCondition: rsiBuyMet ? 1 : 0,
      buyMacdCondition: macdBuyMet ? 1 : 0,
      // Valores negativos para que se apilen hacia abajo
      sellPriceCondition: priceSellMet ? -1 : 0,
      sellRsiCondition: rsiSellMet ? -1 : 0,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const timestamp = new Date(label).toLocaleTimeString();
      
      const buyConditions = payload.filter(p => p.dataKey.startsWith('buy') && p.value > 0);
      const sellConditions = payload.filter(p => p.dataKey.startsWith('sell') && p.value < 0);

      return (
        <div className="bg-background/90 p-3 border rounded-md shadow-lg text-foreground text-xs backdrop-blur-sm">
          <p className="font-bold mb-2">Hora: {timestamp}</p>
          <div className="space-y-1">
             {buyConditions.length > 0 && <p className="font-semibold text-green-500">Condiciones de Compra ({buyConditions.length}):</p>}
             {buyConditions.map(p => <p key={p.dataKey}>✅ {p.name}</p>)}

             {sellConditions.length > 0 && <p className="font-semibold text-red-500 mt-2">Condiciones de Venta ({sellConditions.length}):</p>}
             {sellConditions.map(p => <p key={p.dataKey}>✅ {p.name}</p>)}

             {buyConditions.length === 0 && sellConditions.length === 0 && <p className="text-muted-foreground">Sin condiciones activas</p>}
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
                stackOffset="sign" // Apila valores positivos hacia arriba y negativos hacia abajo
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
                tickFormatter={(value) => `${Math.abs(value)}`} // Muestra el número de condiciones
                label={{ value: 'Nº de Condiciones', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
            
            {/* Áreas de Compra */}
            <Area type="monotone" dataKey="buyPriceCondition" stackId="buy" name="Precio <= BB Inf." stroke={BUY_CONDITION_PRICE_COLOR} fill={BUY_CONDITION_PRICE_COLOR} />
            <Area type="monotone" dataKey="buyRsiCondition" stackId="buy" name="RSI <= 35" stroke={BUY_CONDITION_RSI_COLOR} fill={BUY_CONDITION_RSI_COLOR} />
            <Area type="monotone" dataKey="buyMacdCondition" stackId="buy" name="Cruce MACD" stroke={BUY_CONDITION_MACD_COLOR} fill={BUY_CONDITION_MACD_COLOR} />

            {/* Áreas de Venta */}
            <Area type="monotone" dataKey="sellPriceCondition" stackId="sell" name="Precio >= BB Sup." stroke={SELL_CONDITION_PRICE_COLOR} fill={SELL_CONDITION_PRICE_COLOR} />
            <Area type="monotone" dataKey="sellRsiCondition" stackId="sell" name="RSI >= 65" stroke={SELL_CONDITION_RSI_COLOR} fill={SELL_CONDITION_RSI_COLOR} />

            </AreaChart>
        </ResponsiveContainer>
    </div>
  );
}
