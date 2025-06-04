// src/hooks/useBinanceBalances.ts
import { useState, useEffect, useCallback } from 'react';
// Puedes importar tipos si has definido interfaces para las respuestas de tus APIs en otro lugar
// import { BalancesSuccessResponse, BalancesErrorResponse } from '../types/api-responses'; // Ejemplo

// Interfaz para el formato de balances que esperamos de nuestro endpoint API
interface FormattedBalance {
    available: number;
    onOrder: number;
    total: number;
}

// Tipo para el objeto completo de balances por activo
type AllBalances = Record<string, FormattedBalance>;

interface UseBinanceBalancesProps {
  initialFetch?: boolean; // Para controlar si se hace un fetch inicial al montar
  fetchIntervalMs?: number; // Opcional: Intervalo para actualizar balances automáticamente
  useTestnet?: boolean; // Nuevo: Indica si obtener balances de la red de prueba
}

const useBinanceBalances = ({
  initialFetch = true,
  fetchIntervalMs, // Si no se proporciona, no hay polling automático
  useTestnet = false, // Por defecto, obtener balances de mainnet
}: UseBinanceBalancesProps) => {
  const [balances, setBalances] = useState<AllBalances | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

const fetchBalances = useCallback(async () => {
    setIsLoadingBalances(true);
    setBalancesError(null); // Limpiar errores anteriores

    const networkType = useTestnet ? 'Testnet' : 'Mainnet';
    console.log(`[useBinanceBalances] Iniciando fetch de balances en ${networkType}.`);

    // Determinar el endpoint (si tu endpoint de balances maneja ambas redes)
    // Dado que modificamos /api/binance/balance para manejar ambas redes con un body { isTestnet: boolean }
    const endpoint = '/api/binance/balance'; // Nuestro endpoint unificado

    try {
        console.log(`[useBinanceBalances] Llamando al endpoint: ${endpoint} con useTestnet=${useTestnet}`);
        const response = await fetch(endpoint, {
            method: 'POST', // Usamos POST como decidimos para este endpoint
            headers: {
                'Content-Type': 'application/json',
            },
            // --- CORRECCIÓN: Cambiar isTestnet a useTestnet ---
            body: JSON.stringify({ isTestnet: useTestnet }), // Enviamos la bandera useTestnet en el body
            // --- FIN CORRECCIÓN ---
        });

        console.log(`[useBinanceBalances] Respuesta de balances recibida. Estado: ${response.status}`);

        const result = await response.json(); // Asumiendo que la respuesta es { success: boolean, balances: AllBalances, message: string, details?: string, binanceErrorCode?: number }

        console.log(`[useBinanceBalances] Resultado de balances:`, result);

        if (!response.ok || !result.success) {
            console.error(`[useBinanceBalances] El endpoint ${endpoint} reportó un error o fallo al obtener balances.`);
            const errorDetails = result.message || result.details || `Error HTTP: ${response.status}`;
            setBalancesError(errorDetails);
            setBalances(null); // Limpiar balances en caso de error

        } else {
            console.log(`[useBinanceBalances] Balances obtenidos con éxito de ${networkType}. Cantidad de activos: ${Object.keys(result.balances).length}`);
             // Asegurarse de que result.balances tiene el formato esperado (AllBalances)
             setBalances(result.balances as AllBalances); // Asertar al tipo esperado

        }

    } catch (fetchError: any) {
        console.error(`[useBinanceBalances] Error en la llamada fetch al endpoint ${endpoint}:`, fetchError);
        const errorDetails = `Error de red o inesperado al obtener balances en ${networkType}: ${fetchError.message || 'Error desconocido'}`;
        setBalancesError(errorDetails);
        setBalances(null); // Limpiar balances en caso de error

    } finally {
        setIsLoadingBalances(false);
        console.log(`[useBinanceBalances] Finalizado el fetch de balances en ${networkType}.`);
    }
  }, [useTestnet]); // Dependencia: si useTestnet cambia, volvemos a obtener balances


  // useEffect para la carga inicial y el polling automático (opcional)
  useEffect(() => {
    console.log(`[useBinanceBalances] Efecto de carga inicial/polling activado. initialFetch: ${initialFetch}, fetchIntervalMs: ${fetchIntervalMs}, useTestnet: ${useTestnet}`);
    let intervalId: NodeJS.Timeout | null = null;

    if (initialFetch) {
      fetchBalances(); // Carga inicial si está habilitada
    }

    if (fetchIntervalMs && fetchIntervalMs > 0) {
        console.log(`[useBinanceBalances] Configurando polling automático cada ${fetchIntervalMs / 1000} segundos.`);
        intervalId = setInterval(fetchBalances, fetchIntervalMs);
    } else {
        console.log("[useBinanceBalances] Polling automático no configurado o intervalo inválido.");
    }

    // Función de limpieza
    return () => {
      console.log("[useBinanceBalances] Función de limpieza del efecto de balances activada.");
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[useBinanceBalances] Intervalo de polling de balances limpiado.");
      }
    };
  }, [fetchBalances, initialFetch, fetchIntervalMs, useTestnet]); // Dependencias

  // El hook devuelve el estado y la función para obtener balances manualmente si se necesita
  return {
    balances,
    isLoadingBalances,
    balancesError,
    fetchBalances, // Exponer la función por si se necesita recargar manualmente
  };
};

export default useBinanceBalances;
