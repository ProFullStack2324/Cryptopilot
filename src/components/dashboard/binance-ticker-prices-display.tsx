// src/components/dashboard/binance-ticker-prices-display.tsx

"use client"; //    Marca   este componente   como un Client Component

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart } from "lucide-react"; // Icono para gráficos/precios
import { ScrollArea } from "@/components/ui/scroll-area"; // Para scroll si hay muchos tickers

// Define la interfaz para los datos que esperamos de la API de tickers
interface TickerResponse {
  message: string;
  data: Record<string, string>; // Un objeto donde las claves son strings (ej. "BTCUSDT") y los valores son strings (el precio)
}

interface BinanceTickerPricesDisplayProps {
  // Puedes pasar una lista de símbolos si solo quieres mostrar algunos
  // Si no se pasa, obtendrá todos los que la API devuelva.
  symbols?: string[]; 
}

export function BinanceTickerPricesDisplay({ symbols }: BinanceTickerPricesDisplayProps) {
  const [tickerPrices, setTickerPrices] = useState<TickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickerPrices = async () => {
      try {
        let url = '/api/binance/ticker';
        if (symbols && symbols.length > 0) {
          // Si se especifican símbolos, los añadimos como parámetro de consulta
          url += `?symbol=${symbols.join(',')}`;
        }
        
        const response = await fetch(url); // Llama a tu API de tickers
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error HTTP ${response.status}: ${errorData.message || 'Error desconocido'}`);
        }
        const data: TickerResponse = await response.json();
        setTickerPrices(data);
      } catch (err: any) {
        console.error("[BinanceTickerPricesDisplay] Error al cargar precios de tickers:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTickerPrices();
  }, [symbols]); // Se re-ejecuta si la lista de símbolos cambia

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <LineChart className="w-4 h-4 mr-2" />
          Precios de Tickers de Binance
        </CardTitle>
        <CardDescription className="text-xs">
          Precios actuales de varios pares de criptomonedas en Binance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Cargando precios...</p>}
        {error && <p className="text-sm text-red-500">Error: {error}</p>}
        {tickerPrices && Object.keys(tickerPrices.data).length > 0 ? (
          <ScrollArea className="h-[200px] w-full rounded-md border p-4"> {/* Ajusta la altura según sea necesario */}
            <ul className="grid grid-cols-2 gap-2 text-sm"> {/* Usamos un grid para mostrar dos columnas */}
              {Object.entries(tickerPrices.data).map(([symbol, price]) => (
                <li key={symbol} className="flex justify-between items-center py-1 border-b last:border-b-0">
                  <span className="font-semibold mr-2">{symbol}:</span>
                  <span className="text-right">
                    ${parseFloat(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          !loading && !error && <p className="text-sm text-muted-foreground">No se encontraron precios de tickers.</p>
        )}
      </CardContent>
    </Card>
  );
}