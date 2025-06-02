
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AISignalData, ParsedSignals, SignalItem } from "@/lib/types";
import { Lightbulb, Terminal, Info, AlertTriangle, CheckCircle2, Zap, Brain } from "lucide-react"; 
import { useEffect, useState } from "react";

interface SignalDisplayProps {
  signalData: AISignalData | null;
  isLoading: boolean;
  error: string | null;
}

// Helper (puede moverse a utils si se usa en más sitios)
const isValidSignalItem = (item: any): item is SignalItem => {
  return typeof item === 'object' && item !== null &&
         typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) &&
         typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
};


export function SignalDisplay({ signalData, isLoading, error }: SignalDisplayProps) {
  const [parsedSignals, setParsedSignals] = useState<ParsedSignals | null>(null);
  const [internalParseError, setInternalParseError] = useState<string | null>(null);

  useEffect(() => {
    setInternalParseError(null); // Clear previous internal parse error on new data/error prop
    if (signalData?.signals) {
      try {
        const signalsArray = JSON.parse(signalData.signals);
        if (Array.isArray(signalsArray) && (signalsArray.length === 0 || signalsArray.every(isValidSignalItem))) {
          setParsedSignals(signalsArray as ParsedSignals);
        } else if (Array.isArray(signalsArray) && !signalsArray.every(isValidSignalItem)){
          throw new Error("Uno o más objetos de señal tienen un formato incorrecto (esperado: {signal: 'BUY'|'SELL'|'HOLD', confidence: number}).");
        } 
        else {
          throw new Error("El campo 'signals' no es un array JSON válido de señales.");
        }
      } catch (e) {
        console.error("Error al analizar JSON de señales en SignalDisplay:", e, "Data:", signalData.signals);
        const errorMsg = e instanceof Error ? e.message : "Formato de señales JSON inválido.";
        setInternalParseError(`Error al procesar señales: ${errorMsg}`);
        setParsedSignals(null);
      }
    } else {
      setParsedSignals(null);
    }
  }, [signalData]);
  
  const getSignalBadgeText = (signal: 'BUY' | 'SELL' | 'HOLD'): string => {
    if (signal === 'BUY') return 'COMPRAR';
    if (signal === 'SELL') return 'VENDER';
    return 'MANTENER';
  }
  
  const getSignalBadgeCustomStyle = (signal: 'BUY' | 'SELL' | 'HOLD'): string => {
    if (signal === 'BUY') return 'bg-green-500/90 text-green-50 hover:bg-green-500 dark:bg-green-600/90 dark:text-green-50 dark:hover:bg-green-600 border-green-700 shadow-md';
    if (signal === 'SELL') return 'bg-red-500/90 text-red-50 hover:bg-red-500 dark:bg-red-600/90 dark:text-red-50 dark:hover:bg-red-600 border-red-700 shadow-md';
    return 'bg-slate-500/90 text-slate-50 hover:bg-slate-500 dark:bg-slate-600/90 dark:text-slate-50 dark:hover:bg-slate-600 border-slate-700 shadow-md';
  }


  if (isLoading) {
    return (
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="flex items-center text-primary">
            <Brain className="h-5 w-5 mr-2 animate-pulse" />
            Análisis de IA en Progreso
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

  // Prioritize prop 'error' (from API call) over internalParseError
  const displayError = error || internalParseError;

  if (displayError) {
    return (
      <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive/50 text-destructive-foreground">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle>Error con Señales de IA</AlertTitle>
        <AlertDescription>{displayError}</AlertDescription>
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
          <Alert className="bg-accent/10 border-accent/50 text-accent-foreground">
            <Lightbulb className="h-5 w-5 !text-accent" />
            <AlertTitle className="text-accent">Aún No Se Han Generado Señales</AlertTitle>
            <AlertDescription>
              Usa los "Controles del Bot y Estrategia IA" para solicitar un análisis y generar señales.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-lg bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CheckCircle2 className="h-6 w-6 mr-2 text-green-500" />
          Análisis de IA Completado
        </CardTitle>
        <CardDescription className="text-muted-foreground">Revisa las señales y el análisis proporcionados por la IA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-foreground">
            <Zap className="h-5 w-5 mr-2 text-accent" />
            Señales Clave Identificadas
          </h3>
          {parsedSignals && parsedSignals.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-foreground font-semibold">Señal</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Confianza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedSignals.map((item, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell>
                        <Badge
                          // variant no es necesario si usamos clases directas
                          className={`font-semibold text-xs py-1 px-3 rounded-full ${getSignalBadgeCustomStyle(item.signal)}`}
                        >
                          {getSignalBadgeText(item.signal)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground text-sm">{(item.confidence * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert variant="default" className="bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 !text-blue-500 dark:!text-blue-300" />
                <AlertTitle className="font-medium">Sin Señales de Acción</AlertTitle>
                <AlertDescription className="text-xs">
                La IA no produjo señales de COMPRA/VENTA/MANTENER específicas en este análisis. Revisa la explicación para más detalles.
                </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center text-foreground">
            <Lightbulb className="h-5 w-5 mr-2 text-accent" />
            Explicación de la IA
          </h3>
          <div className="p-4 bg-muted/30 rounded-md border border-border text-sm leading-relaxed text-foreground/90 max-h-60 overflow-y-auto">
            {signalData.explanation || "No se proporcionó explicación detallada."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

