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

export function StrategyDashboard({ latest, decision, selectedMarket }: StrategyDashboardProps) {
  if (!latest || !selectedMarket) {
    return (
      <Card>
        <CardHeader><CardTitle>Diagnóstico de Estrategia</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Esperando datos de la última vela...</p>
        </CardContent>
      </Card>
    );
  }

  const pricePrecision = selectedMarket.pricePrecision;
  
  // Extraer valores de los indicadores
  const rsi = latest.rsi;
  const macdLine = latest.macdLine;
  const signalLine = latest.signalLine;
  const macdHist = latest.macdHistogram;
  const price = latest.closePrice;
  const lowerBB = latest.lowerBollingerBand;
  const upperBB = latest.upperBollingerBand;
  const prevMacdHist = latest.macdHistogram; // Suponiendo que el hook puede proveer esto

  // Definir las condiciones de la estrategia (duplicando la lógica de tradingStrategy para visualización)
  const buyConditionPrice = isValidNumber(price) && isValidNumber(lowerBB) && price <= lowerBB;
  const buyConditionRSI = isValidNumber(rsi) && rsi <= 35;
  const buyConditionMACD = isValidNumber(macdHist) && macdHist > 0 && isValidNumber(prevMacdHist) && macdHist > prevMacdHist;
  
  const sellConditionPrice = isValidNumber(price) && isValidNumber(upperBB) && price >= upperBB;
  const sellConditionRSI = isValidNumber(rsi) && rsi >= 65;
  const sellConditionMACD = isValidNumber(macdHist) && macdHist < 0 && isValidNumber(prevMacdHist) && macdHist < prevMacdHist;

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
          <CardDescription>Evaluación para una señal de COMPRA.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <ConditionStatus 
              label="Precio ≤ BB Inferior"
              value={isValidNumber(price) && isValidNumber(lowerBB) ? `${price.toFixed(pricePrecision)} ≤ ${lowerBB.toFixed(pricePrecision)}` : "N/A"}
              conditionMet={buyConditionPrice}
            />
            <ConditionStatus 
              label="RSI ≤ 35"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={buyConditionRSI}
            />
            <ConditionStatus 
              label="MACD Hist. Creciente"
              value={isValidNumber(macdHist) ? macdHist.toFixed(4) : "N/A"}
              conditionMet={buyConditionMACD}
            />
          </ul>
        </CardContent>
      </Card>

      {/* Condiciones de Venta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condiciones de Venta</CardTitle>
          <CardDescription>Evaluación para una señal de VENTA.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <ConditionStatus 
              label="Precio ≥ BB Superior"
              value={isValidNumber(price) && isValidNumber(upperBB) ? `${price.toFixed(pricePrecision)} ≥ ${upperBB.toFixed(pricePrecision)}` : "N/A"}
              conditionMet={sellConditionPrice}
            />
            <ConditionStatus 
              label="RSI ≥ 65"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={sellConditionRSI}
            />
             <ConditionStatus 
              label="MACD Hist. Decreciente"
              value={isValidNumber(macdHist) ? macdHist.toFixed(4) : "N/A"}
              conditionMet={sellConditionMACD}
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
