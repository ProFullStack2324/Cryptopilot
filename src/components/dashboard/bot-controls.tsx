
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
import { Power, Settings2, DollarSign, Repeat, Waypoints, ShieldCheck, Sparkles, Loader2, BrainCircuit, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  strategy: z.enum(['movingAverage', 'rsi', 'bollingerBands'], { required_error: "Por favor, selecciona una estrategia."}),
  riskLevel: z.enum(['high', 'medium', 'low'], { required_error: "Por favor, selecciona un nivel de riesgo."}),
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
          title: "Señales de IA Generadas",
          description: "Las señales de trading han sido procesadas.",
          variant: "default",
        });
      } catch (error) {
        console.error("Error generando señales:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido al generar señales.";
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
      title: `Bot ${newBotStatus ? "Iniciado (Simulación)" : "Detenido (Simulación)"}`,
      description: `El bot de trading ahora está ${newBotStatus ? "activo" : "inactivo"} en modo simulación. Las operaciones no son reales.`,
       variant: newBotStatus ? "default" : "destructive"
    });
  };


  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Settings2 className="h-5 w-5 mr-2" />
          Controles del Bot y Estrategia
        </CardTitle>
        <CardDescription className="text-muted-foreground">Configura los parámetros y genera señales con IA. La ejecución de trades es simulada.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-background/30">
              <Label htmlFor="bot-status" className="text-base font-medium text-foreground">Estado del Bot:</Label>
              <Button
                id="bot-status"
                type="button"
                variant={isBotRunning ? "destructive" : "default"}
                onClick={toggleBotStatus}
                className="w-[170px] font-semibold" // Ajustado ancho para nuevo texto
              >
                <Power className="mr-2 h-4 w-4" />
                {isBotRunning ? "Detener Bot" : "Iniciar Bot"}
              </Button>
            </div>
             <Alert variant="default" className="bg-accent/10 border-accent/30 text-accent-foreground/80">
              <Info className="h-4 w-4 !text-accent" />
              <AlertTitle className="text-sm font-semibold text-accent">Modo Simulación</AlertTitle>
              <AlertDescription className="text-xs">
                La generación de señales es bajo demanda. La ejecución automática de trades y el funcionamiento continuo del bot requerirían integración con un exchange real.
              </AlertDescription>
            </Alert>


            <FormField
              control={form.control}
              name="amountPerTrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-muted-foreground"><DollarSign className="h-4 w-4 mr-1" />Cantidad por Operación (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ej: 100" {...field} className="bg-input text-foreground placeholder:text-muted-foreground/70"/>
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
                  <FormLabel className="flex items-center text-muted-foreground"><Repeat className="h-4 w-4 mr-1" />Criptomoneda (para análisis IA)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input text-foreground">
                        <SelectValue placeholder="Selecciona una criptomoneda" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover text-popover-foreground">
                      <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      <SelectItem value="SOL">Solana (SOL)</SelectItem>
                      <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs text-muted-foreground/70">
                    Esta selección es para la IA. El mercado de trading se elige arriba.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-muted-foreground"><Waypoints className="h-4 w-4 mr-1" />Estrategia de Trading (IA)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input text-foreground">
                        <SelectValue placeholder="Selecciona una estrategia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover text-popover-foreground">
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
                  <FormLabel className="flex items-center text-muted-foreground"><ShieldCheck className="h-4 w-4 mr-1" />Nivel de Riesgo (IA)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input text-foreground">
                        <SelectValue placeholder="Selecciona un nivel de riesgo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover text-popover-foreground">
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
                  <FormLabel className="text-muted-foreground">Datos Históricos de Precios (JSON para IA)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ingresa datos históricos como cadena JSON" {...field} rows={3} className="font-mono text-xs bg-input text-foreground placeholder:text-muted-foreground/70"/>
                  </FormControl>
                  <FormDescription className="text-muted-foreground/80">
                    Pega los datos para el análisis de la IA. Deben contener timestamp, open, high, low, close, volume.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
              Generar Señales con IA
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
