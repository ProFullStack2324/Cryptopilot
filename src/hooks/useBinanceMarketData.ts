// src/hooks/useBinanceMarketData.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
// Asegúrate de que Market y PRICE_HISTORY_POINTS_TO_KEEP estén importados desde '@/lib/types'
import { MarketPriceDataPoint, PRICE_HISTORY_POINTS_TO_KEEP, Market } from "@/lib/types"; // <-- ¡Asegúrate de importar 'Market'!

// Definimos el intervalo de actualización para los datos de la gráfica de Binance
const BINANCE_CHART_UPDATE_INTERVAL_MS = 60000; // 1 minuto (60 segundos)

interface UseBinanceMarketDataProps {
  symbol?: string; // Ej: BTCUSDT
  timeframe?: string; // Ej: 1m, 5m
  limit?: number; // Cantidad de velas (ej: 200)
  initialFetch?: boolean; // Para controlar si se hace un fetch inicial
}

export function useBinanceMarketData({
  symbol = "BTCUSDT", // Símbolo predeterminado
  timeframe = "1m",   // Timeframe predeterminado (1 minuto)
  limit = PRICE_HISTORY_POINTS_TO_KEEP, // Usar el límite de tu archivo types
  initialFetch = true,
}: UseBinanceMarketDataProps) {
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketPriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // ¡NUEVO ESTADO AQUÍ para almacenar la lista de mercados disponibles!
  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);


  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Función para obtener la lista de todos los mercados disponibles
  const fetchAllAvailableMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    setMarketsError(null);
    try {
      console.log("[useBinanceMarketData] Fetching all available markets...");
      // Asumiendo que tienes un endpoint en tu API para obtener todos los mercados
      // Revisa tu configuración, esto debería ser un endpoint como '/api/binance/exchangeInfo'
      const response = await fetch('/api/binance/exchangeInfo'); // O tu ruta API de Binance para obtener info de intercambio

      if (!response.ok) {
        throw new Error(`Error al obtener lista de mercados: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // Asegúrate de que la estructura de 'data' coincida con lo que esperas de tu API.
      // Aquí asumo que `data.symbols` es un array de objetos con `symbol`, `baseAsset`, `quoteAsset`, etc.
      if (isMountedRef.current && data?.symbols) {
        const parsedMarkets: Market[] = data.symbols.map((s: any) => ({
          id: s.symbol,
          symbol: s.symbol,
          name: `${s.baseAsset}/${s.quoteAsset}`, // Ej: BTC/USDT
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          latestPrice: null // Se actualizará si el ticker lo proporciona o se obtiene aparte
        }));
        setAvailableMarkets(parsedMarkets);
        console.log(`[useBinanceMarketData] Cargados ${parsedMarkets.length} mercados disponibles.`);
      } else if (isMountedRef.current) {
        throw new Error("Formato de datos de mercados inesperado.");
      }
    } catch (err: any) {
      console.error("[useBinanceMarketData] Error al obtener mercados disponibles:", err);
      if (isMountedRef.current) {
        setMarketsError(err.message || "Error desconocido al obtener mercados disponibles.");
        setAvailableMarkets([]); // Limpiar o poner una lista vacía en caso de error
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMarkets(false);
      }
    }
  }, []); // No hay dependencias, se ejecuta una sola vez


  const fetchMarketData = useCallback(async () => {
    if (!initialFetch && !marketHistory.length) return;

    if (!marketHistory.length) {
      setIsLoading(true);
    }
    setError(null);

    console.log(`[useBinanceMarketData] Iniciando fetch de datos de ${symbol} (timeframe: ${timeframe})...`);

    try {
      const response = await fetch(`/api/binance/klines?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);

      if (!response.ok) {
        throw new Error(`Error al obtener klines de Binance: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (isMountedRef.current && data?.klines) {
        const newHistory: MarketPriceDataPoint[] = data.klines;

        if (newHistory.length > 0) {
          setMarketPrice(newHistory[newHistory.length - 1].price);
        }

        if (newHistory.length > limit) {
            setMarketHistory(newHistory.slice(newHistory.length - limit));
        } else {
            setMarketHistory(newHistory);
        }
        console.log(`[useBinanceMarketData] Historial de ${symbol} cargado: ${newHistory.length} puntos.`);
      } else if (isMountedRef.current) {
        throw new Error("Formato de Klines de Binance inesperado.");
      }

    } catch (err: any) {
      console.error(`Error en useBinanceMarketData para ${symbol}:`, err);
      if (isMountedRef.current) {
        setError(err.message || "Error desconocido al obtener datos de mercado.");
        setMarketPrice(null);
        setMarketHistory([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      console.log(`[useBinanceMarketData] Finalizado el fetch de datos para ${symbol}.`);
    }
  }, [symbol, timeframe, limit, marketHistory.length, initialFetch]);

  // useEffect para cargar la lista de todos los mercados disponibles (se ejecuta solo una vez)
  useEffect(() => {
    fetchAllAvailableMarkets();
  }, [fetchAllAvailableMarkets]); // Se ejecuta una vez

  // useEffect para cargar los datos del mercado actual y configurar el intervalo
  useEffect(() => {
    if (initialFetch) {
      fetchMarketData(); // Primera carga si initialFetch es true
    }

    const intervalId = setInterval(fetchMarketData, BINANCE_CHART_UPDATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchMarketData, initialFetch]);

  return {
    marketPrice,
    marketHistory,
    isLoading,
    error,
    availableMarkets, // <-- ¡AHORA SÍ ESTÁ SIENDO RETORNADO!
    isLoadingMarkets,
    marketsError
  };
}