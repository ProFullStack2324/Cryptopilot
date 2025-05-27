
"use client"

import { useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { GenerateTradingSignalsInput, GenerateTradingSignalsOutput } from "@/ai/flows/generate-trading-signals";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Power, Settings2, DollarSign, Repeat, Waypoints, ShieldCheck, Sparkles, Loader2 } from "lucide-react";

const exampleHistoricalData = JSON.stringify([
  {"timestamp": "2023-10-01T00:00:00Z", "open": 27000, "high": 27200, "low": 26800, "close": 27100, "volume": 1000},
  {"timestamp": "2023-10-02T00:00:00Z", "open": 27100, "high": 27500, "low": 27000, "close": 27400, "volume": 1200},
  {"timestamp": "2023-10-03T00:00:00Z", "open": 27400, "high": 28000, "low": 27300, "close": 27900, "volume": 1500},
  {"timestamp": "2023-10-04T00:00:00Z", "open": 27900, "high": 28100, "low": 27700, "close": 27800, "volume": 1100},
  {"timestamp": "2023-10-05T00:00:00Z", "open": 27800, "high": 28200, "low": 27500, "close": 28150, "volume": 1300}
], null, 2);

const formSchema = z.object({
  amountPerTrade: z.coerce.number().min(1, "La cantidad debe ser al menos 1 USD."),
  cryptocurrency: z.string().min(1, "Por favor, selecciona una criptomoneda."),
  strategy: z.enum(['movingAverage', 'rsi', 'bollingerBands']),
  riskLevel: z.enum(['high', 'medium', 'low']),
  historicalData: z.string().refine(data => {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }, "Los datos históricos deben ser JSON válido."),
});

type BotControlsFormValues = z.infer<typeof formSchema>;

interface BotControlsProps {
  onSignalsGenerated: (data: GenerateTradingSignalsOutput) => void;
  onGenerationError: (errorMsg: string) => void;
  clearSignalData: () => void;
  generateSignalsAction: (input: GenerateTradingSignalsInput) => Promise<GenerateTradingSignalsOutput>;
}

export function BotControls({ onSignalsGenerated, onGenerationError, clearSignalData, generateSignalsAction }: BotControlsProps) {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<BotControlsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPerTrade: 100,
      cryptocurrency: "BTC",
      strategy: "movingAverage",
      riskLevel: "medium",
      historicalData: exampleHistoricalData,
    },
  });

  const onSubmit: SubmitHandler<BotControlsFormValues> = async (data) => {
    clearSignalData();
    startTransition(async () => {
      try {
        const aiInput: GenerateTradingSignalsInput = {
          historicalData: data.historicalData,
          strategy: data.strategy,
          riskLevel: data.riskLevel,
        };
        const result = await generateSignalsAction(aiInput);
        onSignalsGenerated(result);
        toast({
          title: "Señales Generadas",
          description: "La IA ha generado exitosamente las señales de trading.",
        });
      } catch (error) {
        console.error("Error generando señales:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        onGenerationError(errorMessage);
        toast({
          title: "Error al Generar Señales",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  };

  const toggleBotStatus = () => {
    const newBotStatus = !isBotRunning;
    setIsBotRunning(newBotStatus);
    
    toast({
      title: `Bot ${newBotStatus ? "Iniciado" : "Detenido"}`,
      description: `El bot de trading ahora está ${newBotStatus ? "funcionando" : "detenido"}.`,
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings2 className="h-5 w-5 mr-2 text-primary" />
          Controles del Bot y Estrategia
        </CardTitle>
        <CardDescription>Configura el bot de trading y genera señales de IA.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="bot-status" className="text-sm font-medium">Estado del Bot</Label>
              <Button
                id="bot-status"
                type="button"
                variant={isBotRunning ? "destructive" : "default"}
                onClick={toggleBotStatus}
                className="w-[140px]" // Increased width for Spanish text
              >
                <Power className="mr-2 h-4 w-4" />
                {isBotRunning ? "Detener Bot" : "Iniciar Bot"}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="amountPerTrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />Cantidad por Operación (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ej: 100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cryptocurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Repeat className="h-4 w-4 mr-1 text-muted-foreground" />Criptomoneda</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una criptomoneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      <SelectItem value="SOL">Solana (SOL)</SelectItem>
                      <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Waypoints className="h-4 w-4 mr-1 text-muted-foreground" />Estrategia de Trading</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una estrategia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="movingAverage">Cruce de Medias Móviles</SelectItem>
                      <SelectItem value="rsi">RSI (Índice de Fuerza Relativa)</SelectItem>
                      <SelectItem value="bollingerBands">Bandas de Bollinger</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><ShieldCheck className="h-4 w-4 mr-1 text-muted-foreground" />Nivel de Riesgo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un nivel de riesgo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Bajo</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="historicalData"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Datos Históricos de Precios (JSON)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ingresa datos históricos como cadena JSON" {...field} rows={5} className="font-mono text-xs"/>
                  </FormControl>
                  <FormDescription>
                    Pega los datos históricos de precios. Cada objeto debe contener timestamp, open, high, low, close y volume.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generar Señales de Trading
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

