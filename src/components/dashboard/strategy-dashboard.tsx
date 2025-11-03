// src/components/dashboard/strategy-dashboard.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketPriceDataPoint, Market, BotOpenPosition } from '@/lib/types';
import clsx from 'clsx';

// Helper para validar si un valor es un número válido
const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

// Props que el componente aceptará
interface StrategyDashboardProps {
  latest: MarketPriceDataPoint | null;
  decision: string;
  selectedMarket: Market | null;
  priceHistory: MarketPriceDataPoint[];
  botOpenPosition?: BotOpenPosition | null; // Opcional
  strategyMode: 'scalping' | 'sniper'; // Para configurar el modo
}

// Componente individual para una condición de la estrategia MEJORADO
const ConditionStatus = ({
    label,
    value,
    conditionMet,
    expected,
}: {
    label: string;
    value: string;
    conditionMet: boolean;
    expected: string;
}) => (
    <li className="flex justify-between items-center text-sm py-1 border-b border-border/50 last:border-b-0">
        <div className="flex flex-col">
            <span className="font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">{expected}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="font-mono text-foreground">{value}</span>
            <span className={clsx("font-bold text-lg", conditionMet ? "text-green-500" : "text-red-500")}>
                {conditionMet ? '✅' : '❌'}
            </span>
        </div>
    </li>
);

export function StrategyDashboard({ latest, decision, selectedMarket, priceHistory, botOpenPosition, strategyMode }: StrategyDashboardProps) {
  if (!latest || !selectedMarket || priceHistory.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Diagnóstico de Estrategia ({strategyMode})</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Esperando datos suficientes de la vela...</p>
        </CardContent>
      </Card>
    );
  }

  const pricePrecision = selectedMarket.pricePrecision;
  const prev = priceHistory[priceHistory.length - 2];
  
  // Extraer valores de los indicadores de la vela actual y previa
  const { rsi, closePrice, lowerBollingerBand, upperBollingerBand, macdHistogram } = latest;
  const prevMacdHistogram = prev?.macdHistogram;

  // Definir las condiciones de la estrategia para visualización
  const buyPriceCondition = isValidNumber(closePrice) && isValidNumber(lowerBollingerBand) && closePrice <= lowerBollingerBand;
  const buyRsiCondition = isValidNumber(rsi) && rsi <= 35;
  const buyMacdCondition = isValidNumber(macdHistogram) && isValidNumber(prevMacdHistogram) && macdHistogram > 0 && prevMacdHistogram <= 0;

  const sellPriceCondition = isValidNumber(closePrice) && isValidNumber(upperBollingerBand) && closePrice >= upperBollingerBand;
  const sellRsiCondition = isValidNumber(rsi) && rsi >= 65;

  const getRequirementsText = () => {
      if (strategyMode === 'scalping') {
          if (botOpenPosition) {
              return `Monitoreando salida: TP (Toma de Ganancias) @ ${botOpenPosition.takeProfitPrice?.toFixed(pricePrecision)}, SL (Límite de Pérdida) @ ${botOpenPosition.stopLossPrice?.toFixed(pricePrecision)}`;
          }
          return "Se requiere 1 de 3 condiciones para COMPRA.";
      }
      // Sniper mode
      if (botOpenPosition) {
        return `Monitoreando salida: TP (Toma de Ganancias) @ ${botOpenPosition.takeProfitPrice?.toFixed(pricePrecision)}, SL (Límite de Pérdida) @ ${botOpenPosition.stopLossPrice?.toFixed(pricePrecision)}`;
    }
      return "Se requieren 2 de 3 condiciones para COMPRA.";
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Decisión Final */}
      <Card className={clsx("md:col-span-1", decision === 'buy' ? "border-green-500" : decision === 'sell' ? "border-red-500" : "border-border")}>
        <CardHeader>
          <CardTitle className="text-lg capitalize">Diagnóstico {strategyMode}</CardTitle>
          <CardDescription>{new Date(latest.timestamp).toLocaleTimeString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className={clsx("text-xl font-bold text-center", {
            'text-green-500': decision === 'buy',
            'text-red-500': decision === 'sell',
            'text-muted-foreground': decision === 'hold' || decision === 'hold_insufficient_funds'
          })}>
            {decision.toUpperCase().replace('_', ' ')}
          </p>
        </CardContent>
      </Card>

      {/* Condiciones de Compra */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condiciones de Compra</CardTitle>
          <CardDescription>{getRequirementsText()}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            <ConditionStatus 
              label="Precio vs BB (Bandas de Bollinger)"
              expected={`Precio <= BB Inf. (${isValidNumber(lowerBollingerBand) ? lowerBollingerBand.toFixed(pricePrecision) : 'N/A'})`}
              value={isValidNumber(closePrice) ? closePrice.toFixed(pricePrecision) : "N/A"}
              conditionMet={buyPriceCondition}
            />
            <ConditionStatus 
              label="RSI (Índice de Fuerza Relativa)"
              expected="RSI <= 35"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={buyRsiCondition}
            />
            <ConditionStatus 
              label="Cruce MACD (Convergencia/Divergencia de Medias Móviles)"
              expected="Histograma > 0"
              value={isValidNumber(macdHistogram) ? macdHistogram.toFixed(4) : "N/A"}
              conditionMet={buyMacdCondition}
            />
          </ul>
        </CardContent>
      </Card>

      {/* Condiciones de Venta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condiciones de Venta (Cierre de Posición)</CardTitle>
          <CardDescription>El bot es "Long-Only" (no abre ventas en corto).</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            <ConditionStatus 
              label="Precio vs BB (Bandas de Bollinger)"
              expected={`Precio >= BB Sup. (${isValidNumber(upperBollingerBand) ? upperBollingerBand.toFixed(pricePrecision) : 'N/A'})`}
              value={isValidNumber(closePrice) ? closePrice.toFixed(pricePrecision) : "N/A"}
              conditionMet={sellPriceCondition}
            />
            <ConditionStatus 
              label="RSI (Índice de Fuerza Relativa)"
              expected="RSI >= 65"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={sellRsiCondition}
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
