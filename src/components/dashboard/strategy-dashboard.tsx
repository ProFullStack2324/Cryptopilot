// src/components/dashboard/strategy-dashboard.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketPriceDataPoint, Market } from '@/lib/types';
import clsx from 'clsx';

// Helper para validar si un valor es un número válido
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Props que el componente aceptará
interface StrategyDashboardProps {
  latest: MarketPriceDataPoint | null;
  decision: string;
  selectedMarket: Market | null;
  priceHistory: MarketPriceDataPoint[];
}

// Componente individual para una condición de la estrategia
const ConditionStatus = ({ label, value, conditionMet }: { label: string, value: string, conditionMet: boolean }) => (
  <li className="flex justify-between items-center text-sm">
    <span>{label}: <span className="font-mono">{value}</span></span>
    <span className={clsx("font-bold text-lg", conditionMet ? "text-green-500" : "text-red-500")}>
      {conditionMet ? '✅' : '❌'}
    </span>
  </li>
);

export function StrategyDashboard({ latest, decision, selectedMarket, priceHistory }: StrategyDashboardProps) {
  if (!latest || !selectedMarket || priceHistory.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Diagnóstico de Estrategia</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Esperando datos suficientes de la vela...</p>
        </CardContent>
      </Card>
    );
  }

  const pricePrecision = selectedMarket.pricePrecision;
  const prev = priceHistory[priceHistory.length - 2];
  
  // Extraer valores de los indicadores de la vela actual y previa
  const rsi = latest.rsi;
  const price = latest.closePrice;
  const lowerBB = latest.lowerBollingerBand;
  const upperBB = latest.upperBollingerBand;
  const macdHist = latest.macdHistogram;
  const prevMacdHist = prev.macdHistogram;

  // Definir las condiciones de la estrategia para visualización
  const buyPriceCondition = isValidNumber(price) && isValidNumber(lowerBB) && price <= lowerBB;
  const buyRsiCondition = isValidNumber(rsi) && rsi <= 35;
  const buyMacdCondition = isValidNumber(macdHist) && isValidNumber(prevMacdHist) && macdHist > 0 && prevMacdHist <= 0;

  const sellPriceCondition = isValidNumber(price) && isValidNumber(upperBB) && price >= upperBB;
  const sellRsiCondition = isValidNumber(rsi) && rsi >= 65;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Decisión Final */}
      <Card className={clsx("md:col-span-1", decision === 'buy' ? "border-green-500" : decision === 'sell' ? "border-red-500" : "border-border")}>
        <CardHeader>
          <CardTitle className="text-lg">Decisión Actual</CardTitle>
          <CardDescription>{new Date(latest.timestamp).toLocaleTimeString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className={clsx("text-3xl font-bold text-center", {
            'text-green-500': decision === 'buy',
            'text-red-500': decision === 'sell',
            'text-muted-foreground': decision === 'hold'
          })}>
            {decision.toUpperCase()}
          </p>
        </CardContent>
      </Card>

      {/* Condiciones de Compra */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condiciones de Compra</CardTitle>
          <CardDescription>2 de 3 condiciones requeridas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <ConditionStatus 
              label="Precio ≤ BB Inferior"
              value={isValidNumber(price) && isValidNumber(lowerBB) ? `${price.toFixed(pricePrecision)} ≤ ${lowerBB.toFixed(pricePrecision)}` : "N/A"}
              conditionMet={buyPriceCondition}
            />
            <ConditionStatus 
              label="RSI ≤ 35"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={buyRsiCondition}
            />
            <ConditionStatus 
              label="MACD Hist. cruza a > 0"
              value={isValidNumber(macdHist) ? macdHist.toFixed(4) : "N/A"}
              conditionMet={buyMacdCondition}
            />
          </ul>
        </CardContent>
      </Card>

      {/* Condiciones de Venta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condiciones de Venta</CardTitle>
          <CardDescription>1 de 2 condiciones requeridas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <ConditionStatus 
              label="Precio ≥ BB Superior"
              value={isValidNumber(price) && isValidNumber(upperBB) ? `${price.toFixed(pricePrecision)} ≥ ${upperBB.toFixed(pricePrecision)}` : "N/A"}
              conditionMet={sellPriceCondition}
            />
            <ConditionStatus 
              label="RSI ≥ 65"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={sellRsiCondition}
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
