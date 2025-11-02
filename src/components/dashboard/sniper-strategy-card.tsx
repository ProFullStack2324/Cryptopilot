// src/components/dashboard/sniper-strategy-card.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketPriceDataPoint, Market, BotOpenPosition } from '@/lib/types';
import clsx from 'clsx';
import { Check, X, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { STRATEGY_CONFIG } from '@/lib/strategies/tradingStrategy';

const isValidNumber = (value: any): value is number => typeof value === 'number' && !isNaN(value);

interface StrategyCardProps {
  latest: MarketPriceDataPoint | null;
  market: Market | null;
  history: MarketPriceDataPoint[];
  openPosition: BotOpenPosition | null;
}

const ConditionStatus = ({ label, value, conditionMet, expected }: { label: string; value: string; conditionMet: boolean | null; expected?: string; }) => (
    <li className="flex justify-between items-center text-sm py-1.5 border-b border-border/50 last:border-b-0">
        <div className="flex flex-col">
            <span className="font-semibold">{label}</span>
            {expected && <span className="text-xs text-muted-foreground">{expected}</span>}
        </div>
        <div className="flex items-center gap-2">
            <span className="font-mono text-foreground">{value}</span>
            {conditionMet === true && <Check className="w-5 h-5 text-green-500" />}
            {conditionMet === false && <X className="w-5 h-5 text-red-500" />}
            {conditionMet === null && <Minus className="w-5 h-5 text-muted-foreground" />}
        </div>
    </li>
);

export function SniperStrategyCard({ latest, market, history, openPosition }: StrategyCardProps) {
  const config = STRATEGY_CONFIG.sniper;
  const isRelevantPosition = openPosition?.strategy === 'sniper';

  if (!latest || !market || history.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Diagnóstico Sniper</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Esperando datos suficientes...</p></CardContent>
      </Card>
    );
  }

  const prev = history[history.length - 2];
  const { closePrice, lowerBollingerBand, rsi, macdHistogram, upperBollingerBand } = latest;
  const prevMacdHistogram = prev?.macdHistogram;

  // --- Condiciones de Compra ---
  const buyPriceCondition = isValidNumber(closePrice) && isValidNumber(lowerBollingerBand) && closePrice <= lowerBollingerBand;
  const buyRsiCondition = isValidNumber(rsi) && rsi <= STRATEGY_CONFIG.rsiBuyThreshold;
  const buyMacdCondition = isValidNumber(macdHistogram) && isValidNumber(prevMacdHistogram) && macdHistogram > 0 && prevMacdHistogram <= 0;
  const buyConditionsMet = (buyPriceCondition ? 1 : 0) + (buyRsiCondition ? 1 : 0) + (buyMacdCondition ? 1 : 0);

  // --- Condiciones de Venta ---
  const sellTakeProfitCondition = isRelevantPosition && isValidNumber(openPosition?.takeProfitPrice) && closePrice >= openPosition.takeProfitPrice;
  const sellStopLossCondition = isRelevantPosition && isValidNumber(openPosition?.stopLossPrice) && closePrice <= openPosition.stopLossPrice;
  const sellRsiCondition = isRelevantPosition && isValidNumber(rsi) && rsi >= STRATEGY_CONFIG.rsiSellThreshold;

  // --- Decisión Actual ---
  let decision = "MANTENER";
  if (isRelevantPosition) {
    if (sellTakeProfitCondition || sellStopLossCondition || sellRsiCondition) {
      decision = "VENDER";
    } else {
      decision = "POSICIÓN ABIERTA";
    }
  } else if (buyConditionsMet >= config.minBuyConditions) {
    decision = "COMPRAR";
  }

  return (
    <Card className={clsx("border-2", 
        decision === 'COMPRAR' ? "border-green-500/80" : 
        decision === 'VENDER' ? "border-red-500/80" :
        decision === 'POSICIÓN ABIERTA' ? "border-blue-500/80" :
        "border-border"
    )}>
      <CardHeader>
        <CardTitle className="text-xl flex justify-between items-center">
          <span>Sniper</span>
          <span className={clsx("text-lg font-bold px-2 py-1 rounded", {
            'bg-green-500/10 text-green-500': decision === 'COMPRAR',
            'bg-red-500/10 text-red-500': decision === 'VENDER',
            'bg-blue-500/10 text-blue-500': decision === 'POSICIÓN ABIERTA',
            'bg-muted text-muted-foreground': decision === 'MANTENER'
          })}>
            {decision}
          </span>
        </CardTitle>
        <CardDescription>Requiere {config.minBuyConditions} condiciones de compra. Vende por TP, SL o RSI alto.</CardDescription>
      </CardHeader>
      <CardContent>
        {isRelevantPosition ? (
          <>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowUp className="w-4 h-4 text-red-500"/>Condiciones de Venta</h4>
            <ul className="space-y-2">
              <ConditionStatus label="Take Profit" expected={`>= ${openPosition.takeProfitPrice?.toFixed(2)}`} value={closePrice.toFixed(2)} conditionMet={sellTakeProfitCondition} />
              <ConditionStatus label="Stop Loss" expected={`<= ${openPosition.stopLossPrice?.toFixed(2)}`} value={closePrice.toFixed(2)} conditionMet={sellStopLossCondition} />
              <ConditionStatus label="RSI Sobrecompra" expected={`>= ${STRATEGY_CONFIG.rsiSellThreshold}`} value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"} conditionMet={sellRsiCondition} />
            </ul>
          </>
        ) : (
          <>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowDown className="w-4 h-4 text-green-500"/>Condiciones de Compra</h4>
            <ul className="space-y-2">
              <ConditionStatus label="Precio vs BB Inf." expected={`<= ${isValidNumber(lowerBollingerBand) ? lowerBollingerBand.toFixed(market.pricePrecision) : 'N/A'}`} value={isValidNumber(closePrice) ? closePrice.toFixed(market.pricePrecision) : "N/A"} conditionMet={buyPriceCondition} />
              <ConditionStatus label="RSI Sobreventa" expected={`<= ${STRATEGY_CONFIG.rsiBuyThreshold}`} value={isValidNumber(rsi) ? rsi.toFixed(2) : "N/A"} conditionMet={buyRsiCondition} />
              <ConditionStatus label="Cruce MACD" expected="> 0" value={isValidNumber(macdHistogram) ? macdHistogram.toFixed(4) : "N/A"} conditionMet={buyMacdCondition} />
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
