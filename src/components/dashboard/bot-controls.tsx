
"use client"

// Importaciones necesarias (ajustadas)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BotIcon, Play, StopCircle, Info, Brain } from "lucide-react"; // Brain para IA
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { useState } from "react";
import type { GenerateTradingSignalsInput } from "@/ai/flows/generate-trading-signals";


// Definir las props ACTUALIZADAS
interface BotControlsProps {
  isBotRunning: boolean; 
  onToggleBot: () => void; 
  onGenerateSignals: (strategy: GenerateTradingSignalsInput['strategy'], riskLevel: GenerateTradingSignalsInput['riskLevel']) => void; // Para el botón manual de IA
  selectedMarketSymbol?: string; // Para mostrar en la UI
  isLoadingAiSignals: boolean; // Para deshabilitar botón mientras carga IA
}

export function BotControls({
  isBotRunning,
  onToggleBot,
  onGenerateSignals,
  selectedMarketSymbol,
  isLoadingAiSignals,
}: BotControlsProps) {
  const [strategy, setStrategy] = useState<GenerateTradingSignalsInput['strategy']>('movingAverage');
  const [riskLevel, setRiskLevel] = useState<GenerateTradingSignalsInput['riskLevel']>('medium');

  const handleManualSignalGeneration = () => {
    if (selectedMarketSymbol) {
      onGenerateSignals(strategy, riskLevel);
    }
  };

  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <BotIcon className="h-5 w-5 mr-2" /> 
          Control del Bot y Estrategia IA
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Inicia/detén el bot o genera señales de IA manualmente para {selectedMarketSymbol || "el mercado actual"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4"> 
           <Alert variant="default" className="bg-accent/10 border-accent/30 text-accent-foreground/80">
              <Info className="h-4 w-4 !text-accent" />
              <AlertTitle className="text-sm font-semibold text-accent">Estado del Bot</AlertTitle>
              <AlertDescription className="text-xs">
                 El bot está: <span className={`font-semibold ${isBotRunning ? 'text-green-500' : 'text-red-500'}`}>{isBotRunning ? 'ACTIVO' : 'INACTIVO'}</span>.
                 {isBotRunning && ` Operando en ${selectedMarketSymbol || 'mercado actual'} según su estrategia.`}
                 {!isBotRunning && " Las operaciones automáticas están detenidas."}
              </AlertDescription> 
            </Alert>

        <div className="flex flex-col items-center justify-center gap-3"> 
          <Button
            className={`w-full font-semibold ${isBotRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`} 
            onClick={onToggleBot} 
          >
             {isBotRunning ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} 
            {isBotRunning ? 'Detener Bot Automático' : 'Iniciar Bot Automático'} 
          </Button>
        </div>

        <div className="border-t border-border pt-4 mt-4 space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center"><Brain className="w-4 h-4 mr-2 text-purple-500"/>Generar Señales con IA (Manual)</h4>
            <div className="space-y-2">
                <div>
                    <Label htmlFor="strategy-select" className="text-xs">Estrategia IA</Label>
                    <Select value={strategy} onValueChange={(v) => setStrategy(v as any)} disabled={isLoadingAiSignals}>
                        <SelectTrigger id="strategy-select" className="w-full h-9 text-xs">
                            <SelectValue placeholder="Selecciona estrategia" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="movingAverage">Cruce de Medias Móviles</SelectItem>
                            <SelectItem value="rsi">RSI (Índice de Fuerza Relativa)</SelectItem>
                            <SelectItem value="bollingerBands">Bandas de Bollinger</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="risk-level-select" className="text-xs">Nivel de Riesgo IA</Label>
                    <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as any)} disabled={isLoadingAiSignals}>
                        <SelectTrigger id="risk-level-select" className="w-full h-9 text-xs">
                            <SelectValue placeholder="Selecciona nivel de riesgo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Bajo</SelectItem>
                            <SelectItem value="medium">Medio</SelectItem>
                            <SelectItem value="high">Alto</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <Button
                className="w-full font-semibold bg-purple-600 hover:bg-purple-700"
                onClick={handleManualSignalGeneration}
                disabled={isLoadingAiSignals || !selectedMarketSymbol}
            >
                {isLoadingAiSignals ? "Generando Análisis IA..." : "Analizar Mercado con IA"}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
