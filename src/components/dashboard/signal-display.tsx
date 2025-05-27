
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AISignalData, ParsedSignals, SignalItem } from "@/lib/types";
import { Lightbulb, Terminal, Info, AlertTriangle, CheckCircle2, Zap } from "lucide-react"; // Changed icons
import { useEffect, useState } from "react";

interface SignalDisplayProps {
  signalData: AISignalData | null;
  isLoading: boolean;
  error: string | null;
}

export function SignalDisplay({ signalData, isLoading, error }: SignalDisplayProps) {
  const [parsedSignals, setParsedSignals] = useState<ParsedSignals | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (signalData?.signals) {
      try {
        const signalsArray = JSON.parse(signalData.signals);
        if (Array.isArray(signalsArray) && signalsArray.every(isValidSignalItem)) {
          setParsedSignals(signalsArray as ParsedSignals);
          setParseError(null);
        } else {
          throw new Error("Los datos analizados no son un array válido de señales.");
        }
      } catch (e) {
        console.error("Error al analizar JSON de señales:", e);
        setParseError("Error al analizar las señales de trading. El formato podría ser incorrecto.");
        setParsedSignals(null);
      }
    } else {
      setParsedSignals(null);
      setParseError(null);
    }
  }, [signalData]);

  const isValidSignalItem = (item: any): item is SignalItem => {
    return typeof item === 'object' && item !== null &&
           typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
           typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
  };
  
  const getSignalBadgeText = (signal: 'BUY' | 'SELL' | 'HOLD'): string => {
    if (signal === 'BUY') return 'COMPRAR';
    if (signal === 'SELL') return 'VENDER';
    return 'MANTENER';
  }

  const getSignalBadgeVariant = (signal: 'BUY' | 'SELL' | 'HOLD'): "default" | "destructive" | "secondary" => {
    if (signal === 'BUY') return 'default'; // Default usually is green-ish in themes
    if (signal === 'SELL') return 'destructive'; // Destructive is red
    return 'secondary'; // Secondary for hold
  }
  
  const getSignalBadgeCustomStyle = (signal: 'BUY' | 'SELL' | 'HOLD'): string => {
    if (signal === 'BUY') return 'bg-green-500/80 text-green-50 hover:bg-green-500/90 dark:bg-green-600/80 dark:text-green-50 dark:hover:bg-green-600/90 border-green-700';
    if (signal === 'SELL') return 'bg-red-500/80 text-red-50 hover:bg-red-500/90 dark:bg-red-600/80 dark:text-red-50 dark:hover:bg-red-600/90 border-red-700';
    return 'bg-gray-500/80 text-gray-50 hover:bg-gray-500/90 dark:bg-gray-600/80 dark:text-gray-50 dark:hover:bg-gray-600/90 border-gray-700';
  }


  if (isLoading) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Zap className="h-5 w-5 mr-2 animate-pulse" />
            Señales de Trading IA
          </CardTitle>
          <CardDescription className="text-muted-foreground">Generando señales, por favor espera...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted"></div>
          <div className="h-20 w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive text-destructive-foreground">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Error al Generar Señales</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!signalData) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
             <Info className="h-5 w-5 mr-2" />
            Señales Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Alert className="bg-accent/10 border-accent text-accent-foreground">
            <Lightbulb className="h-5 w-5" />
            <AlertTitle>Aún No Se Han Generado Señales</AlertTitle>
            <AlertDescription>
              Configura los parámetros y haz clic en "Generar Señales con IA" para ver las recomendaciones.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  if (parseError) {
     return (
      <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive text-destructive-foreground">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Error de Visualización de Señal</AlertTitle>
        <AlertDescription>{parseError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CheckCircle2 className="h-6 w-6 mr-2 text-green-500" />
          Señales de Trading IA Recibidas
        </CardTitle>
        <CardDescription className="text-muted-foreground">Revisa las señales y el análisis proporcionados por la IA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-foreground">
            <Zap className="h-5 w-5 mr-2 text-accent" />
            Señales Clave
          </h3>
          {parsedSignals && parsedSignals.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-foreground">Señal</TableHead>
                    <TableHead className="text-right text-foreground">Confianza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedSignals.map((item, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge
                          variant={getSignalBadgeVariant(item.signal)}
                          className={`font-semibold text-xs py-1 px-2.5 ${getSignalBadgeCustomStyle(item.signal)}`}
                        >
                          {getSignalBadgeText(item.signal)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">{(item.confidence * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No se generaron señales de trading específicas o no pudieron ser analizadas.</p>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center text-foreground">
            <Lightbulb className="h-5 w-5 mr-2 text-accent" />
            Análisis de la IA
          </h3>
          <div className="p-4 bg-muted/30 rounded-md border border-border text-sm leading-relaxed text-foreground/90">
            {signalData.explanation || "No se proporcionó explicación."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
