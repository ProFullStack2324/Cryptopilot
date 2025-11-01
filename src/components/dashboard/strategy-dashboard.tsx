// src/components/dashboard/strategy-dashboard.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketPriceDataPoint, Market, BotOpenPosition } from '@/lib/types';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';

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
    <li className="flex justify-between items-center text-sm py-1.5 border-b border-border/50 last:border-b-0">
        <div className="flex flex-col">
            <span className="font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">{expected}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="font-mono text-foreground">{value}</span>
            {conditionMet ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
        </div>
    </li>
);

export function StrategyDashboard({ latest, selectedMarket, priceHistory, botOpenPosition, strategyMode }: StrategyDashboardProps) {
  if (!latest || !selectedMarket || priceHistory.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{strategyMode} Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Esperando datos suficientes de la vela...</p>
        </CardContent>
      </Card>
    );
  }

  const pricePrecision = selectedMarket.pricePrecision;
  const prev = priceHistory[priceHistory.length - 2];
  
  // Extraer valores de los indicadores de la vela actual y previa
  const { rsi, closePrice, lowerBollingerBand, macdHistogram, buyConditionsMet, sellConditionsMet } = latest;
  const prevMacdHistogram = prev?.macdHistogram;

  // Definir las condiciones de la estrategia para visualización
  const buyPriceCondition = isValidNumber(closePrice) && isValidNumber(lowerBollingerBand) && closePrice <= lowerBollingerBand;
  const buyRsiCondition = isValidNumber(rsi) && rsi <= 35;
  const buyMacdCondition = isValidNumber(macdHistogram) && isValidNumber(prevMacdHistogram) && macdHistogram > 0 && prevMacdHistogram <= 0;

  const totalBuyConditionsMet = (buyPriceCondition ? 1 : 0) + (buyRsiCondition ? 1 : 0) + (buyMacdCondition ? 1 : 0);

  const getRequirementsText = () => {
      const requirements = strategyMode === 'scalping' ? 1 : 2;
      return `Se requiere ${requirements} de 3 condiciones.`;
  }
  
  const getDecision = () => {
    if (botOpenPosition && botOpenPosition.strategy === strategyMode) {
        return "POSICIÓN ABIERTA";
    }
    const requirements = strategyMode === 'scalping' ? 1 : 2;
    if (totalBuyConditionsMet >= requirements) {
        return "COMPRAR";
    }
    // Lógica para VENDER si se cumplen las condiciones de venta (no solo las de compra)
    if ((sellConditionsMet || 0) > 0) {
        return "VENDER";
    }
    return "MANTENER";
  }

  const currentDecision = getDecision();

  return (
    <Card className={clsx("border-2", 
        currentDecision === 'COMPRAR' ? "border-green-500/80" : 
        currentDecision === 'VENDER' ? "border-red-500/80" :
        currentDecision === 'POSICIÓN ABIERTA' ? "border-blue-500/80" :
        "border-border"
    )}>
      <CardHeader>
        <CardTitle className="text-xl flex justify-between items-center">
            <span className="capitalize">{strategyMode}</span>
            <span className={clsx("text-lg font-bold px-2 py-1 rounded", {
                'bg-green-500/10 text-green-500': currentDecision === 'COMPRAR',
                'bg-red-500/10 text-red-500': currentDecision === 'VENDER',
                'bg-blue-500/10 text-blue-500': currentDecision === 'POSICIÓN ABIERTA',
                'bg-muted text-muted-foreground': currentDecision === 'MANTENER'
            })}>
                {currentDecision}
            </span>
        </CardTitle>
        <CardDescription>{getRequirementsText()}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
            <ConditionStatus 
              label="Precio vs BB Inf."
              expected={`<= ${isValidNumber(lowerBollingerBand) ? lowerBollingerBand.toFixed(pricePrecision) : 'N/A'}`}
              value={isValidNumber(closePrice) ? closePrice.toFixed(pricePrecision) : "N/A"}
              conditionMet={buyPriceCondition}
            />
            <ConditionStatus 
              label="RSI Sobreventa"
              expected="<= 35"
              value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"}
              conditionMet={buyRsiCondition}
            />
            <ConditionStatus 
              label="Cruce MACD"
              expected="Positivo"
              value={isValidNumber(macdHistogram) ? macdHistogram.toFixed(4) : "N/A"}
              conditionMet={buyMacdCondition}
            />
        </ul>
      </CardContent>
    </Card>
  );
}
