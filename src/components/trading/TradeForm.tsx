'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Ya tenías Card
import { useToast } from '@/hooks/use-toast';
import { Market } from '@/lib/types'; // Asumiendo que Market es importable

// Definir la interfaz para los datos que enviaremos al backend
interface TradeRequest {
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number; // Opcional para órdenes de límite
}

interface TradeFormProps {
  market: Market; // El mercado seleccionado (ej. BTCUSDT)
  currentPrice: number | null; // El precio actual del mercado
  availableQuoteBalance: number; // Ej. balance de USDT
  availableBaseBalance: number; // Ej. balance de BTC
  onBotTrade?: (tradeData: TradeRequest) => Promise<any>; // Función para que el bot realice una orden
}

export default function TradeForm({
  market,
  currentPrice,
  availableQuoteBalance,
  availableBaseBalance,
  onBotTrade,
}: TradeFormProps) {
  const [type, setType] = useState<TradeRequest['type']>('market');
  const [side, setSide] = useState<TradeRequest['side']>('buy'); // 'buy' o 'sell'
  const [amount, setAmount] = useState<string>(''); // Usar string para el input y parsear al enviar
  const [price, setPrice] = useState<string>(''); // Usar string para el input y parsear al enviar
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Actualizar símbolo y precio cuando el mercado cambia
  useEffect(() => {
    if (market) {
      // Si el precio actual es válido, pre-llenar para órdenes límite
      if (currentPrice !== null && currentPrice > 0) {
        setPrice(currentPrice.toFixed(market.pricePrecision || 2)); // Usar precisión del mercado
      } else {
        setPrice(''); // Limpiar si no hay precio válido
      }
      // Opcional: Podrías resetear la cantidad si cambias de símbolo
      setAmount('');
    }
  }, [market, currentPrice]);

  const executeTrade = useCallback(async (tradeData: TradeRequest) => {
    setLoading(true);
    try {
      const response = await fetch('/api/binance/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tradeData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: '¡Orden Exitosa!',
          description: `Orden ${tradeData.side.toUpperCase()} ${tradeData.amount} ${tradeData.symbol}. ID: ${data.orderId}. Estado: ${data.status}`,
          variant: 'default',
        });
        // Opcional: limpiar formulario o actualizar balances
        setAmount('');
        // Para órdenes limit, podrías mantener el precio si quieres reintentar
        if (tradeData.type === 'market') {
          if (currentPrice) setPrice(currentPrice.toFixed(market.pricePrecision || 2));
          else setPrice('');
        }
        return data; // Devolver los datos para el bot
      } else {
        const errorMessage = data.message || 'Error desconocido al crear la orden.';
        toast({
          title: 'Error al Crear Orden',
          description: errorMessage,
          variant: 'destructive',
        });
        console.error('Error en la respuesta del API:', data);
        throw new Error(errorMessage); // Lanzar error para que el bot lo maneje
      }
    } catch (error: any) {
      const errorMessage = `Error de conexión o inesperado: ${error.message || 'No se pudo conectar con el servidor.'}`;
      toast({
        title: 'Error de Conexión',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error('Error en la llamada fetch:', error);
      throw error; // Lanzar error para que el bot lo maneje
    } finally {
      setLoading(false);
    }
  }, [toast, currentPrice, market]);

  // Manejador para el envío manual del formulario
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    const parsedPrice = type === 'limit' ? parseFloat(price) : undefined;

    // Validaciones en el frontend
    if (!market || !market.symbol || !market.baseAsset || !market.quoteAsset) {
      toast({
        title: 'Error de Configuración',
        description: 'Información del mercado no disponible.',
        variant: 'destructive',
      });
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Cantidad Inválida',
        description: 'La cantidad debe ser un número positivo.',
        variant: 'destructive',
      });
      return;
    }
    if (type === 'limit' && (isNaN(parsedPrice!) || parsedPrice! <= 0)) {
      toast({
        title: 'Precio Límite Inválido',
        description: 'Para una orden límite, el precio es obligatorio y debe ser un número positivo.',
        variant: 'destructive',
      });
      return;
    }

    // Validaciones de balance
    if (side === 'buy') {
      const cost = type === 'market' ? parsedAmount * (currentPrice || 0) : parsedAmount * parsedPrice!;
      if (cost > availableQuoteBalance) {
        toast({
          title: 'Fondos Insuficientes',
          description: `Necesitas ${cost.toFixed(market.quotePrecision || 2)} ${market.quoteAsset}. Solo tienes ${availableQuoteBalance.toFixed(market.quotePrecision || 2)} ${market.quoteAsset}.`,
          variant: 'destructive',
        });
        return;
      }
    } else { // sell
      if (parsedAmount > availableBaseBalance) {
        toast({
          title: 'Activos Insuficientes',
          description: `Necesitas ${parsedAmount.toFixed(market.basePrecision || 6)} ${market.baseAsset}. Solo tienes ${availableBaseBalance.toFixed(market.basePrecision || 6)} ${market.baseAsset}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const tradeData: TradeRequest = {
      symbol: market.symbol,
      type,
      side,
      amount: parsedAmount,
      price: parsedPrice,
    };

    await executeTrade(tradeData);
  };

  // Exponer executeTrade a onBotTrade si está definido
  useEffect(() => {
    if (onBotTrade) {
      // Esto es un placeholder. En realidad, el bot llamaría a onBotTrade directamente
      // Puedes pasar executeTrade a onBotTrade si quieres que el bot use la misma lógica de UI y notificación
      // O puedes mantener onBotTrade como una función que el bot implementa para llamar a executeTrade
      // Por simplicidad, aquí asumiremos que onBotTrade ya envolverá executeTrade si es necesario.
    }
  }, [onBotTrade, executeTrade]);


  return (
    <div className="p-4 space-y-4">
      {/* Botones de Lado: Comprar / Vender */}
      <div className="flex gap-2">
        <Button
          onClick={() => setSide('buy')}
          className={`flex-1 text-lg font-bold ${side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
          disabled={loading}
        >
          Comprar {market?.baseAsset || 'Activo'}
        </Button>
        <Button
          onClick={() => setSide('sell')}
          className={`flex-1 text-lg font-bold ${side === 'sell' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
          disabled={loading}
        >
          Vender {market?.baseAsset || 'Activo'}
        </Button>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-4">
        {/* Símbolo (mostrar, no editable directamente) */}
        <div>
          <Label htmlFor="symbol" className="text-sm font-medium text-gray-300">Símbolo</Label>
          <Input
            id="symbol"
            value={market?.symbol || ''}
            readOnly
            className="mt-1 bg-gray-700 border-gray-600 text-white cursor-not-allowed"
          />
        </div>

        {/* Tipo de Orden */}
        <div>
          <Label htmlFor="type" className="text-sm font-medium text-gray-300">Tipo de Orden</Label>
          <Select value={type} onValueChange={(value: TradeRequest['type']) => setType(value)} disabled={loading}>
            <SelectTrigger className="w-full mt-1 bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Selecciona tipo de orden" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-gray-600">
              <SelectItem value="market">Mercado</SelectItem>
              <SelectItem value="limit">Límite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Precio Límite (condicional) */}
        {type === 'limit' && (
          <div>
            <Label htmlFor="price" className="text-sm font-medium text-gray-300">Precio Límite ({market?.quoteAsset || 'USDT'})</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="any"
              required={type === 'limit'}
              placeholder={currentPrice !== null ? currentPrice.toFixed(market.pricePrecision || 2) : 'Ej. 30000.00'}
              className="mt-1 bg-gray-700 border-gray-600 text-white"
              disabled={loading}
            />
          </div>
        )}

        {/* Cantidad */}
        <div>
          <Label htmlFor="amount" className="text-sm font-medium text-gray-300">Cantidad ({side === 'buy' ? market?.baseAsset : market?.baseAsset})</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="any"
            required
            placeholder="0.001"
            className="mt-1 bg-gray-700 border-gray-600 text-white"
            disabled={loading}
          />
          {/* Muestra el balance disponible */}
          <p className="text-xs text-gray-400 mt-1">
            Balance disponible: {side === 'buy'
              ? `${availableQuoteBalance.toFixed(market?.quotePrecision || 2)} ${market?.quoteAsset || 'USDT'}`
              : `${availableBaseBalance.toFixed(market?.basePrecision || 6)} ${market?.baseAsset || 'BTC'}`}
          </p>
        </div>

        {/* Botón de envío final */}
        <Button
          type="submit"
          className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-colors duration-200 text-lg
            ${side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={loading}
        >
          {loading ? 'Procesando...' : (side === 'buy' ? `Comprar ${market?.baseAsset || 'Activo'}` : `Vender ${market?.baseAsset || 'Activo'}`)}
        </Button>
      </form>
    </div>
  );
}