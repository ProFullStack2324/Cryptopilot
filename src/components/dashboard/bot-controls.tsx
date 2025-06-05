"use client"

// Importaciones necesarias (ajustadas)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// useToast puede mantenerse si se usa para mensajes, pero no es estrictamente necesario para el control de inicio/parada
// import { useToast } from "@/hooks/use-toast";
// Iconos actualizados
import { BotIcon, Play, StopCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Mantener si se usa la alerta de estado

// Definir las props ACTUALIZADAS
interface BotControlsProps {
  isBotRunning: boolean; // Estado actual del bot (viene de useTradingBot)
  onToggleBot: () => void; // Función para iniciar/detener el bot (viene de useTradingBot)
  // Puedes decidir mantener clearSignalData y selectedMarketSymbol si son útiles para algo más en el futuro,
  // pero para la funcionalidad básica de inicio/parada no son estrictamente necesarias aquí.
  // clearSignalData?: () => void;
  // selectedMarketSymbol?: string;
}

export function BotControls({
  isBotRunning,
  onToggleBot,
  // clearSignalData, // Si se mantiene
  // selectedMarketSymbol, // Si se mantiene
}: BotControlsProps) {
  // Eliminamos toda la lógica y estado relacionado con el formulario y la IA


  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <BotIcon className="h-5 w-5 mr-2" /> {/* Usar el icono del bot */}
          Control del Bot de Trading
        </CardTitle>
        <CardDescription className="text-muted-foreground">Inicia o detén tu bot de trading basado en estrategias técnicas.</CardDescription> {/* Texto actualizado */}
      </CardHeader>
      <CardContent className="space-y-4"> {/* Espaciado ajustado */}

           <Alert variant="default" className="bg-accent/10 border-accent/30 text-accent-foreground/80">
              <Info className="h-4 w-4 !text-accent" />
              <AlertTitle className="text-sm font-semibold text-accent">Estado del Bot</AlertTitle>
              <AlertDescription className="text-xs">
                 El bot está actualmente: <span className={`font-semibold ${isBotRunning ? 'text-green-500' : 'text-red-500'}`}>{isBotRunning ? 'ACTIVO' : 'INACTIVO'}</span>. Las operaciones se basan en la estrategia configurada (SMA/MACD, etc.) y usan tus balances reales de Binance.
              </AlertDescription> {/* Texto actualizado */}
            </Alert>

        <div className="flex flex-col items-center justify-center gap-4"> {/* Contenedor para el botón */}
          <Button
            className={`w-full font-semibold ${isBotRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`} // Color dinámico
            onClick={onToggleBot} // Llama a la prop onToggleBot
          >
             {isBotRunning ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} {/* Icono dinámico */}
            {isBotRunning ? 'Detener Bot' : 'Iniciar Bot'} {/* Texto dinámico */}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
