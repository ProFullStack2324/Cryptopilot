
"use client";

import { useState } from "react";
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
  balanceUSD: number; // Saldo en la moneda de cotización (ej. USD)
  baseAssetBalance: number; // Saldo en el activo base (ej. BTC)
  onSubmit: (data: OrderFormData) => void;
}

const formSchema = z.object({
  orderType: z.enum(["market", "limit"], { required_error: "Selecciona un tipo de orden."}),
  amount: z.coerce.number().positive("La cantidad debe ser positiva."),
  price: z.coerce.number().optional(), // Opcional, requerido para órdenes límite
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

export function OrderForm({ market, balanceUSD, baseAssetBalance, onSubmit }: OrderFormProps) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const { toast } = useToast();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderType: "market",
      amount: 0,
      price: market.latestPrice || 0,
    },
  });

  const watchOrderType = form.watch("orderType");
  const watchAmount = form.watch("amount");
  const watchPrice = form.watch("price");

  const handleSubmit: SubmitHandler<OrderFormValues> = (data) => {
    const orderData: OrderFormData = {
      type: tradeType,
      marketId: market.id,
      amount: data.amount,
      price: data.orderType === "limit" ? data.price : market.latestPrice, // Usar precio de mercado si es orden de mercado
      orderType: data.orderType,
    };
    onSubmit(orderData);
    toast({
      title: `Orden de ${tradeType === 'buy' ? 'Compra' : 'Venta'} Enviada (Simulada)`,
      description: `${data.amount} ${market.baseAsset} @ ${data.orderType === 'limit' ? data.price : 'Mercado'}`,
      variant: "default"
    });
    form.reset({ amount: 0, price: market.latestPrice || 0, orderType: data.orderType });
  };

  const estimatedTotal = tradeType === 'buy' 
    ? watchAmount * (watchOrderType === 'limit' ? (watchPrice || 0) : (market.latestPrice || 0))
    : watchAmount * (watchOrderType === 'limit' ? (watchPrice || 0) : (market.latestPrice || 0));

  const maxBuyAmount = (market.latestPrice && market.latestPrice > 0) ? balanceUSD / market.latestPrice : 0;
  const maxSellAmount = baseAssetBalance;


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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs text-muted-foreground">Tipo de Orden</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
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
                      <Input type="number" placeholder={`Precio por ${market.baseAsset}`} {...field} step="any" className="bg-input text-foreground text-sm h-9"/>
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
                    <Input type="number" placeholder="0.00" {...field} step="any" className="bg-input text-foreground text-sm h-9"/>
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
                <span className="font-medium text-foreground">${balanceUSD.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo {market.baseAsset} (Simulado):</span>
                <span className="font-medium text-foreground">{baseAssetBalance.toLocaleString(undefined, {minimumFractionDigits:6, maximumFractionDigits:6})}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Estimado ({market.quoteAsset}):</span>
                <span className="font-medium text-foreground">${estimatedTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
            </div>
            <Button 
              type="submit" 
              className={`w-full font-semibold mt-2 h-10 text-base ${tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
              disabled={watchAmount <=0 || (watchOrderType === 'limit' && (!watchPrice || watchPrice <=0))}
            >
              {tradeType === 'buy' ? `Comprar ${market.baseAsset}` : `Vender ${market.baseAsset}`}
            </Button>
          </form>
        </Form>
      </CardContent>
      {/* <CardFooter className="pt-2 pb-3">
       
      </CardFooter> */}
    </Card>
  );
}
