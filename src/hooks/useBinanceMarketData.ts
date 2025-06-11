
// src/hooks/useBinanceMarketData.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MarketPriceDataPoint, PRICE_HISTORY_POINTS_TO_KEEP, Market, UseBinanceMarketDataProps } from "@/lib/types";

const BINANCE_CHART_UPDATE_INTERVAL_MS = 60000;

export function useBinanceMarketData({
  symbol = "BTCUSDT",
  timeframe = "1m",
  limit = PRICE_HISTORY_POINTS_TO_KEEP,
  initialFetch = true,
}: UseBinanceMarketDataProps) { // useTestnet eliminado de props
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketPriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchAllAvailableMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    setMarketsError(null);
    console.log(`[useBinanceMarketData] Fetching all available markets from Mainnet...`);

    try {
      // Llamada a /api/binance/symbols ahora siempre asume Mainnet
      const response = await fetch('/api/binance/symbols', {
          method: 'POST', // Mantenemos POST si el endpoint lo requiere
          headers: { 'Content-Type': 'application/json' },
          // Ya no se envía isTestnet en el body
      });

      if (!response.ok) {
        console.error(`[useBinanceMarketData] Error al obtener lista de mercados de Mainnet: ${response.status} ${response.statusText}`);
        throw new Error(`Error al obtener lista de mercados de Mainnet: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[useBinanceMarketData] Respuesta de mercados recibida de Mainnet.`, data);

      if (isMountedRef.current && data?.symbols) {
        const parsedMarkets: Market[] = data.symbols.map((s: any) => ({
          id: s.id,
          symbol: s.symbol,
          name: s.name,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          latestPrice: null,
          minNotional: s.minNotional,
          minQty: s.minQty,
          amountPrecision: s.amountPrecision,
          pricePrecision: s.pricePrecision,
          quotePrecision: s.quotePrecision,
          basePrecision: s.basePrecision,
        }));
        setAvailableMarkets(parsedMarkets);
        console.log(`[useBinanceMarketData] Cargados ${parsedMarkets.length} mercados disponibles de Mainnet.`);
      } else if (isMountedRef.current) {
        console.error(`[useBinanceMarketData] Formato de datos de mercados inesperado de Mainnet. Datos:`, data);
        throw new Error(`Formato de datos de mercados inesperado de Mainnet.`);
      }
    } catch (err: any) {
      console.error(`[useBinanceMarketData] Error al obtener mercados disponibles de Mainnet:`, err);
      if (isMountedRef.current) {
        setMarketsError(err.message || `Error desconocido al obtener mercados disponibles de Mainnet.`);
        setAvailableMarkets([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMarkets(false);
        console.log(`[useBinanceMarketData] Finalizado fetch de mercados de Mainnet.`);
      }
    }
  }, []); // Dependencias vacías, se ejecuta una vez o cuando se llama manualmente

  const fetchMarketData = useCallback(async () => {
    if (!symbol) {
        console.warn("[useBinanceMarketData] Símbolo no seleccionado. Saltando fetch de datos de mercado.");
        setIsLoading(false);
        return;
    }
    if (marketHistory.length === 0) {
       setIsLoading(true);
    }
    setError(null);
    console.log(`[useBinanceMarketData] Iniciando fetch de datos de ${symbol} (timeframe: ${timeframe}) de Mainnet...`);

    try {
      // Llamada a /api/binance/klines ya no incluye isTestnet
      const response = await fetch(`/api/binance/klines?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);

      if (!response.ok) {
        console.error(`[useBinanceMarketData] Error al obtener klines de Binance Mainnet: ${response.status} ${response.statusText}`);
        throw new Error(`Error al obtener klines de Binance Mainnet: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[useBinanceMarketData] Respuesta de klines recibida de Mainnet.`, data);

      if (isMountedRef.current && data?.klines) {
        const newHistory: MarketPriceDataPoint[] = data.klines;
        if (newHistory.length > 0) {
          setMarketPrice(newHistory[newHistory.length - 1].price);
        }
        setMarketHistory(newHistory.slice(-limit)); // Asegurar que se mantiene el límite
        console.log(`[useBinanceMarketData] Historial de ${symbol} cargado: ${newHistory.length} puntos. Aplicado límite de ${limit}.`);
      } else if (isMountedRef.current) {
        console.error(`[useBinanceMarketData] Formato de Klines de Binance inesperado de Mainnet. Datos:`, data);
        throw new Error(`Formato de Klines de Binance inesperado de Mainnet.`);
      }
    } catch (err: any) {
      console.error(`[useBinanceMarketData] Error en useBinanceMarketData para ${symbol} en Mainnet:`, err);
      if (isMountedRef.current) {
        setError(err.message || `Error desconocido al obtener datos de mercado de Mainnet.`);
        setMarketPrice(null);
        setMarketHistory([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      console.log(`[useBinanceMarketData] Finalizado el fetch de datos para ${symbol} de Mainnet.`);
    }
  }, [symbol, timeframe, limit, marketHistory.length]); // marketHistory.length para controlar el setIsLoading

  useEffect(() => {
    console.log(`[useBinanceMarketData] Efecto de carga de mercados activado.`);
    fetchAllAvailableMarkets();
  }, [fetchAllAvailableMarkets]);

  useEffect(() => {
    console.log(`[useBinanceMarketData] Efecto de carga de datos de mercado/polling activado. symbol: ${symbol}, initialFetch: ${initialFetch}`);
    if (initialFetch && symbol) {
      fetchMarketData();
    }
    let intervalId: NodeJS.Timeout | null = null;
    if (symbol) {
        console.log(`[useBinanceMarketData] Configurando polling para ${symbol} cada ${BINANCE_CHART_UPDATE_INTERVAL_MS / 1000} segundos en Mainnet.`);
        intervalId = setInterval(fetchMarketData, BINANCE_CHART_UPDATE_INTERVAL_MS);
    } else {
        console.log("[useBinanceMarketData] No hay símbolo seleccionado. No se configura polling de datos de mercado.");
    }
    return () => {
      console.log("[useBinanceMarketData] Función de limpieza del efecto de datos de mercado activada.");
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[useBinanceMarketData] Intervalo de polling de datos de mercado limpiado.");
      }
    };
  }, [fetchMarketData, initialFetch, symbol]);

  return {
    marketPrice,
    marketHistory,
    isLoading,
    error,
    availableMarkets,
    isLoadingMarkets,
    marketsError
  };
}
