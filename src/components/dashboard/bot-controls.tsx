
"use client"

import { useTransition, useEffect } from "react"; 
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { GenerateTradingSignalsInput, GenerateTradingSignalsOutput } from "@/ai/flows/generate-trading-signals";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Label se usa a través de FormLabel
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings2, DollarSign, Repeat, Waypoints, ShieldCheck, BrainCircuit, Info, Loader2 } from "lucide-react";
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
  cryptocurrencyForAI: z.string().min(1, "Por favor, selecciona un activo para el análisis de IA."),
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
  generateSignalsAction: (input: GenerateTradingSignalsInput) => Promise<void>; // Retorna Promise<void> ahora
  selectedMarketSymbol: string; 
}

export function BotControls({ 
  onSignalsGenerated, 
  onGenerationError, 
  clearSignalData, 
  generateSignalsAction, 
  selectedMarketSymbol 
}: BotControlsProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<BotControlsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPerTrade: 100,
      cryptocurrencyForAI: selectedMarketSymbol || "BTC",
      strategy: "movingAverage",
      riskLevel: "medium",
      historicalData: exampleHistoricalData,
    },
  });

  useEffect(() => {
    if (selectedMarketSymbol) {
      form.setValue("cryptocurrencyForAI", selectedMarketSymbol);
    }
  }, [selectedMarketSymbol, form]);


 const onSubmit: SubmitHandler<BotControlsFormValues> = async (data) => {
    clearSignalData();
    startTransition(async () => {
      try {
        const aiInput: GenerateTradingSignalsInput = {
          historicalData: data.historicalData,
          strategy: data.strategy,
          riskLevel: data.riskLevel,
          cryptocurrencyForAI: data.cryptocurrencyForAI, // Asegurar que se pasa
        };
        // generateSignalsAction ya maneja onSignalsGenerated y onGenerationError internamente
        await generateSignalsAction(aiInput); 
        toast({
          title: "Petición de Señales IA Enviada",
          description: "Las señales de trading están siendo procesadas por la IA.",
          variant: "default",
        });
      } catch (error) {
        // Este catch es por si generateSignalsAction (el wrapper) relanza un error que no fue manejado internamente
        // o si hay un error en la propia transición.
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido al enviar la petición de señales.";
        console.error("Error en BotControls onSubmit:", errorMessage, error);
        // onGenerationError(errorMessage); // onGenerationError es llamado dentro de generateSignalsActionWrapper
        toast({
          title: "Error al Solicitar Señales",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <Settings2 className="h-5 w-5 mr-2" />
          Controles del Bot y Estrategia IA
        </CardTitle>
        <CardDescription className="text-muted-foreground">Configura parámetros y genera señales con IA. La ejecución de trades es simulada.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
             <Alert variant="default" className="bg-accent/10 border-accent/30 text-accent-foreground/80">
              <Info className="h-4 w-4 !text-accent" />
              <AlertTitle className="text-sm font-semibold text-accent">Modo Simulación</AlertTitle>
              <AlertDescription className="text-xs">
                El estado del bot (Iniciado/Detenido) es visual. La generación de señales es bajo demanda. La IA puede simular trades automáticamente si las señales son de alta confianza.
              </AlertDescription>
            </Alert>

            <FormField
              control={form.control}
              name="amountPerTrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-muted-foreground"><DollarSign className="h-4 w-4 mr-1" />Cantidad por Operación Manual (USD - Simulado)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="ej: 100" {...field} className="bg-input text-foreground placeholder:text-muted-foreground/70"/>
                  </FormControl>
                   <FormDescription className="text-xs text-muted-foreground/70">
                    Este monto se usa para operaciones manuales desde el formulario de órdenes. Las operaciones simuladas por IA usan una cantidad predefinida.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cryptocurrencyForAI"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-muted-foreground"><Repeat className="h-4 w-4 mr-1" />Activo (para contexto IA)</FormLabel>
                  <FormControl>
                    {/* Usamos un Input deshabilitado para mostrar el símbolo del mercado seleccionado */}
                    <Input
                      {...field}
                      readOnly // Hace que el input no sea editable
                      disabled // Deshabilita visualmente el input
                      className="bg-input text-foreground placeholder:text-muted-foreground/70"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground/70">
                    El modelo de IA analizará el activo seleccionado actualmente: {selectedMarketSymbol}.
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
