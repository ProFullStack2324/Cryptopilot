
"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Market, OrderFormData } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Landmark, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderFormProps {
  market: Market;
  balanceQuoteAsset: number; 
  balanceBaseAsset: number; 
  onSubmit: (data: OrderFormData) => void;
}

const formSchema = z.object({
  orderType: z.enum(["market", "limit"], { required_error: "Selecciona un tipo de orden."}),
  amount: z.coerce.number().positive("La cantidad debe ser positiva.").min(0.000001, "La cantidad es demasiado pequeña."), // Mínimo más realista
  price: z.coerce.number().optional(),
}).refine(data => {
  if (data.orderType === "limit") {
    return data.price !== undefined && data.price > 0;
  }
  return true;
}, {
  message: "El precio es requerido para órdenes límite y debe ser positivo.",
  path: ["price"],
});

type OrderFormValues = z.infer<typeof formSchema>;

export function OrderForm({ market, balanceQuoteAsset, balanceBaseAsset, onSubmit }: OrderFormProps) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const { toast } = useToast();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderType: "market",
      amount: undefined, // Dejar vacío para que el placeholder funcione
      price: market.latestPrice || undefined,
    },
  });

  // Resetear el precio si cambia el mercado
  useEffect(() => {
    form.reset({ 
        orderType: form.getValues("orderType") || "market", 
        amount: undefined, // Limpiar cantidad también
        price: market.latestPrice || undefined 
    });
  }, [market, form]);


  const watchOrderType = form.watch("orderType");
  const watchAmount = form.watch("amount") || 0; // Default to 0 if undefined for calculations
  const watchPrice = form.watch("price");

  const handleSubmitInternal: SubmitHandler<OrderFormValues> = (data) => {
    // El toast de éxito/error ahora se maneja en page.tsx
    // Aquí solo llamamos a la función onSubmit pasada como prop.
    onSubmit({
      type: tradeType,
      marketId: market.id,
      amount: data.amount,
      price: data.orderType === "limit" ? data.price : market.latestPrice, 
      orderType: data.orderType,
    });
    // Resetear solo la cantidad después del envío, mantener tipo de orden y precio límite si existe
    form.reset({ ...form.getValues(), amount: undefined }); 
  };

  const priceForEstimation = watchOrderType === 'limit' ? (watchPrice || 0) : (market.latestPrice || 0);
  const estimatedTotal = watchAmount * priceForEstimation;

  const maxBuyAmount = (priceForEstimation > 0) ? balanceQuoteAsset / priceForEstimation : 0;
  const maxSellAmount = balanceBaseAsset;
  
  const insufficientFundsForBuy = tradeType === 'buy' && estimatedTotal > balanceQuoteAsset && watchAmount > 0;
  const insufficientFundsForSell = tradeType === 'sell' && watchAmount > balanceBaseAsset && watchAmount > 0;

  const submitButtonDisabled = 
    watchAmount <= 0 || 
    (watchOrderType === 'limit' && (!watchPrice || watchPrice <= 0)) ||
    (tradeType === 'buy' && insufficientFundsForBuy) ||
    (tradeType === 'sell' && insufficientFundsForSell);


  return (
    <Card className="shadow-lg bg-card text-card-foreground h-full flex flex-col">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex items-center text-xl">
          <ShoppingCart className="h-5 w-5 mr-2 text-primary" />
          Colocar Orden: {market.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button
            variant={tradeType === 'buy' ? 'default' : 'outline'}
            onClick={() => setTradeType('buy')}
            className="w-full bg-green-600 hover:bg-green-700 text-white data-[variant=outline]:bg-transparent data-[variant=outline]:text-current data-[variant=outline]:border-green-600"
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Comprar
          </Button>
          <Button
            variant={tradeType === 'sell' ? 'destructive' : 'outline'}
            onClick={() => setTradeType('sell')}
            className="w-full bg-red-600 hover:bg-red-700 text-white data-[variant=outline]:bg-transparent data-[variant=outline]:text-current data-[variant=outline]:border-red-600"
          >
            <TrendingDown className="mr-2 h-4 w-4" /> Vender
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitInternal)} className="space-y-3">
            <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs text-muted-foreground">Tipo de Orden</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === 'market') {
                            form.setValue('price', market.latestPrice || undefined, { shouldValidate: true });
                        }
                      }}
                      defaultValue={field.value}
                      className="flex space-x-3 pt-1"
                    >
                      <FormItem className="flex items-center space-x-1 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="market" />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">Mercado</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-1 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="limit" />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">Límite</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage className="text-xs"/>
                </FormItem>
              )}
            />

            {watchOrderType === 'limit' && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">Precio ({market.quoteAsset})</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={`Precio por ${market.baseAsset}`} 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        step="any" 
                        className="bg-input text-foreground text-sm h-9"
                      />
                    </FormControl>
                    <FormMessage className="text-xs"/>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Cantidad ({market.baseAsset})</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                      step="any" 
                      className="bg-input text-foreground text-sm h-9"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground/70">
                    {tradeType === 'buy' 
                      ? `Máx. aprox.: ${maxBuyAmount.toFixed(6)} ${market.baseAsset}` 
                      : `Disponible: ${maxSellAmount.toFixed(6)} ${market.baseAsset}`
                    }
                  </FormDescription>
                  <FormMessage className="text-xs"/>
                </FormItem>
              )}
            />
            
            <Separator />
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Saldo {market.quoteAsset} (Simulado):</span>
                <span className="font-medium text-foreground">${balanceQuoteAsset.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo {market.baseAsset} (Simulado):</span>
                <span className="font-medium text-foreground">{balanceBaseAsset.toLocaleString(undefined, {minimumFractionDigits:Math.min(8, market.baseAsset === 'BTC' ? 8 : 4), maximumFractionDigits:Math.min(8, market.baseAsset === 'BTC' ? 8 : 4)})}</span>
              </div>
               {watchAmount > 0 && (
                <div className="flex justify-between">
                    <span>Total Estimado ({market.quoteAsset}):</span>
                    <span className="font-medium text-foreground">${estimatedTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                </div>
               )}
            </div>
            {insufficientFundsForBuy && <p className="text-xs text-red-500">Fondos ({market.quoteAsset}) insuficientes.</p>}
            {insufficientFundsForSell && <p className="text-xs text-red-500">Fondos ({market.baseAsset}) insuficientes.</p>}
            <Button 
              type="submit" 
              className={`w-full font-semibold mt-2 h-10 text-base ${tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
              disabled={submitButtonDisabled}
            >
              {tradeType === 'buy' ? `Comprar ${market.baseAsset}` : `Vender ${market.baseAsset}`}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
