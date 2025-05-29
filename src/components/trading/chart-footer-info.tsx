"use client";

import { CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { marketPriceChartConfigDark, PRICE_HISTORY_POINTS_TO_KEEP } from "@/lib/types";
import type { MarketPriceDataPoint } from "@/lib/types";

interface ChartFooterInfoProps {
  lastPoint: MarketPriceDataPoint & {
    date: string;
    sma10?: number;
    sma20?: number;
    sma50?: number;
  };
  marketName: string;
  marketId: string;
  isClient: boolean;
}

export function ChartFooterInfo({
  lastPoint,
  marketName,
  marketId,
  isClient,
}: ChartFooterInfoProps) {
  return (
    <CardFooter className="flex-col items-start gap-1 text-xs pt-1 pb-3">
      {!isClient ? (
        <>
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/2" />
        </>
      ) : (
        <>
          <div className="flex gap-2 font-medium leading-none text-foreground flex-wrap text-sm">
            {" "}
            {/* Ajustado tamaño de texto */}
            <span>
              Últ. precio ({marketName}):{" "}
              <span style={{ color: marketPriceChartConfigDark.price.color }}>
                $
                {lastPoint.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits:
                    marketName.includes("BTC") || marketName.includes("ETH")
                      ? 2
                      : 5,
                })}
                .
              </span>
            </span>
            {lastPoint.sma10 !== undefined && (
              <span style={{ color: marketPriceChartConfigDark.sma10.color }}>
                SMA10: $
                {lastPoint.sma10.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits:
                    marketName.includes("BTC") || marketName.includes("ETH")
                      ? 2
                      : 5,
                })}
              </span>
            )}
            {lastPoint.sma20 !== undefined && (
              <span style={{ color: marketPriceChartConfigDark.sma20.color }}>
                SMA20: $
                {lastPoint.sma20.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits:
                    marketName.includes("BTC") || marketName.includes("ETH")
                      ? 2
                      : 5,
                })}
              </span>
            )}
            {lastPoint.sma50 !== undefined && (
              <span style={{ color: marketPriceChartConfigDark.sma50.color }}>
                SMA50: $
                {lastPoint.sma50.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits:
                    marketName.includes("BTC") || marketName.includes("ETH")
                      ? 2
                      : 5,
                })}
              </span>
            )}
          </div>
          <div className="leading-none text-muted-foreground">
            {/* Actualizamos el texto para reflejar la frecuencia de actualización de CoinGecko */}
            {marketId === "BTCUSDT"
              ? `Actualizado desde CoinGecko cada ~60s. Mostrando ${PRICE_HISTORY_POINTS_TO_KEEP} puntos.`
              : `Simulación: actualizando cada 1.5-3s. Mostrando últimos ${PRICE_HISTORY_POINTS_TO_KEEP} puntos.`}
          </div>
        </>
      )}
    </CardFooter>
  );
}