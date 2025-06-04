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
  // --- INICIO SECCIÓN MODIFICADA: Añadir prop para usar Testnet ---
  useTestnet?: boolean; // Nuevo: Indica si obtener datos de mercado de la red de prueba
  // --- FIN SECCIÓN MODIFICADA: Añadir prop para usar Testnet ---
}

export function useBinanceMarketData({
  symbol = "BTCUSDT", // Símbolo predeterminado
  timeframe = "1m",   // Timeframe predeterminado (1 minuto)
  limit = PRICE_HISTORY_POINTS_TO_KEEP, // Usar el límite de tu archivo types
  initialFetch = true,
  // --- INICIO SECCIÓN MODIFICADA: Desestructurar useTestnet ---
  useTestnet = false, // Valor por defecto para la nueva prop
  // --- FIN SECCIÓN MODIFICADA: Desestructurar useTestnet ---
}: UseBinanceMarketDataProps) {
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketPriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // ¡NUEVO ESTADO AQUÍ para almacenar la lista de mercados disponibles!
  // Este estado ya existía, solo lo mantengo
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
  // Esta función DEBE usar el endpoint /api/binance/symbols que modificamos para recibir { isTestnet: boolean } en el body POST
  const fetchAllAvailableMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    setMarketsError(null);

    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useBinanceMarketData] Fetching all available markets from ${networkType}...`);

    try {
      // --- INICIO SECCIÓN MODIFICADA: Llamar a endpoint de symbols con POST y body isTestnet ---
      const response = await fetch('/api/binance/symbols', {
          method: 'POST', // Usamos POST
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isTestnet: useTestnet }), // Enviamos la bandera isTestnet en el body
      });
      // --- FIN SECCIÓN MODIFICADA: Llamar a endpoint de symbols con POST y body isTestnet ---


      if (!response.ok) {
        console.error(`[useBinanceMarketData] Error al obtener lista de mercados de ${networkType}: ${response.status} ${response.statusText}`);
        throw new Error(`Error al obtener lista de mercados de ${networkType}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
       console.log(`[useBinanceMarketData] Respuesta de mercados recibida de ${networkType}.`, data);

      // Asegúrate de que la estructura de 'data' coincida con lo que esperas de tu API.
      // Aquí asumo que `data.symbols` es un array de objetos con `symbol`, `baseAsset`, `quoteAsset`, etc.
      if (isMountedRef.current && data?.symbols) {
        const parsedMarkets: Market[] = data.symbols.map((s: any) => ({
          id: s.id, // Usar s.id que ahora devolvemos del endpoint
          symbol: s.symbol, // Usar s.symbol estandarizado
          name: s.name, // Usar s.name formateado
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          latestPrice: null, // Se actualizará si el ticker lo proporciona o se obtiene aparte
          // --- INICIO SECCIÓN MODIFICADA: Incluir reglas de trading ---
          minNotional: s.minNotional,
          minQty: s.minQty,
          amountPrecision: s.amountPrecision,
          pricePrecision: s.pricePrecision,
          quotePrecision: s.quotePrecision, // Usar la propiedad correcta si tu Market la define
          // --- FIN SECCIÓN MODIFICADA: Incluir reglas de trading ---
        }));
        setAvailableMarkets(parsedMarkets);
        console.log(`[useBinanceMarketData] Cargados ${parsedMarkets.length} mercados disponibles de ${networkType}.`);
      } else if (isMountedRef.current) {
         console.error(`[useBinanceMarketData] Formato de datos de mercados inesperado de ${networkType}. Datos:`, data);
        throw new Error(`Formato de datos de mercados inesperado de ${networkType}.`);
      }
    } catch (err: any) {
      console.error(`[useBinanceMarketData] Error al obtener mercados disponibles de ${networkType}:`, err);
      if (isMountedRef.current) {
        setMarketsError(err.message || `Error desconocido al obtener mercados disponibles de ${networkType}.`);
        setAvailableMarkets([]); // Limpiar o poner una lista vacía en caso de error
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMarkets(false);
         console.log(`[useBinanceMarketData] Finalizado fetch de mercados de ${networkType}.`);
      }
    }
  }, [useTestnet]); // Dependencia: si useTestnet cambia, volvemos a obtener mercados


  const fetchMarketData = useCallback(async () => {
    if (!symbol) {
        console.warn("[useBinanceMarketData] Símbolo no seleccionado. Saltando fetch de datos de mercado.");
        setIsLoading(false); // Asegurarse de que el estado de carga se desactiva si no hay símbolo
        return;
    }
    if (!initialFetch && marketHistory.length > 0) { // Ajuste: si no es fetch inicial y ya tenemos historial, no resetear loading a true inmediatamente
        console.log("[useBinanceMarketData] No es fetch inicial y ya hay historial. Skipping fetch de datos de mercado.");
        return;
    }


    if (marketHistory.length === 0) { // Solo mostrar loading si no hay datos previos
       setIsLoading(true);
    }
    setError(null);

    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useBinanceMarketData] Iniciando fetch de datos de ${symbol} (timeframe: ${timeframe}) de ${networkType}...`);

    try {
      // --- INICIO SECCIÓN MODIFICADA: Llamar a endpoint de klines con query param isTestnet ---
      const response = await fetch(`/api/binance/klines?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}&isTestnet=${useTestnet}`);
      // --- FIN SECCIÓN MODIFICADA: Llamar a endpoint de klines con query param isTestnet ---


      if (!response.ok) {
         console.error(`[useBinanceMarketData] Error al obtener klines de Binance ${networkType}: ${response.status} ${response.statusText}`);
        throw new Error(`Error al obtener klines de Binance ${networkType}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
       console.log(`[useBinanceMarketData] Respuesta de klines recibida de ${networkType}.`, data);


      if (isMountedRef.current && data?.klines) {
        const newHistory: MarketPriceDataPoint[] = data.klines;

        if (newHistory.length > 0) {
          setMarketPrice(newHistory[newHistory.length - 1].price);
        }

        // Asegurarse de mantener solo el número correcto de puntos
        if (newHistory.length > limit) {
            setMarketHistory(newHistory.slice(newHistory.length - limit));
            console.log(`[useBinanceMarketData] Historial de ${symbol} cargado y truncado a ${limit} puntos. Recibidos: ${newHistory.length}.`);
        } else {
            setMarketHistory(newHistory);
            console.log(`[useBinanceMarketData] Historial de ${symbol} cargado: ${newHistory.length} puntos.`);
        }

      } else if (isMountedRef.current) {
         console.error(`[useBinanceMarketData] Formato de Klines de Binance inesperado de ${networkType}. Datos:`, data);
        throw new Error(`Formato de Klines de Binance inesperado de ${networkType}.`);
      }

    } catch (err: any) {
      console.error(`[useBinanceMarketData] Error en useBinanceMarketData para ${symbol} en ${networkType}:`, err);
      if (isMountedRef.current) {
        setError(err.message || `Error desconocido al obtener datos de mercado de ${networkType}.`);
        setMarketPrice(null);
        setMarketHistory([]); // Limpiar historial en caso de error
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      console.log(`[useBinanceMarketData] Finalizado el fetch de datos para ${symbol} de ${networkType}.`);
    }
  }, [symbol, timeframe, limit, initialFetch, useTestnet]); // Añadir useTestnet a las dependencias


  // useEffect para cargar la lista de todos los mercados disponibles (se ejecuta cuando useTestnet cambia)
  useEffect(() => {
    console.log(`[useBinanceMarketData] Efecto de carga de mercados activado. useTestnet: ${useTestnet}`);
    fetchAllAvailableMarkets();
  }, [fetchAllAvailableMarkets, useTestnet]); // Añadir useTestnet a las dependencias


  // useEffect para cargar los datos del mercado actual y configurar el intervalo
  useEffect(() => {
    console.log(`[useBinanceMarketData] Efecto de carga de datos de mercado/polling activado. symbol: ${symbol}, initialFetch: ${initialFetch}, useTestnet: ${useTestnet}`);

    if (initialFetch && symbol) { // Asegurarse de que haya un símbolo seleccionado para la carga inicial
      fetchMarketData(); // Primera carga si initialFetch es true y hay un símbolo
    }

    // Configurar el intervalo de actualización solo si hay un símbolo seleccionado
    let intervalId: NodeJS.Timeout | null = null;
    if (symbol) {
        console.log(`[useBinanceMarketData] Configurando polling para ${symbol} cada ${BINANCE_CHART_UPDATE_INTERVAL_MS / 1000} segundos en ${useTestnet ? 'Testnet' : 'Mainnet'}.`);
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
  }, [fetchMarketData, initialFetch, symbol, useTestnet]); // Añadir useTestnet a las dependencias


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
