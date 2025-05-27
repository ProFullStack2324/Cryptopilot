
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AISignalData, ParsedSignals, SignalItem } from "@/lib/types";
import { Lightbulb, Terminal, Info, AlertCircle, CheckCircle } from "lucide-react";
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
           typeof item.signal === 'string' && ['BUY', 'SELL', 'HOLD'].includes(item.signal) && // Keep these as is for logic
           typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1;
  };
  
  const getSignalBadgeText = (signal: 'BUY' | 'SELL' | 'HOLD'): string => {
    if (signal === 'BUY') return 'COMPRAR';
    if (signal === 'SELL') return 'VENDER';
    return 'MANTENER';
  }


  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lightbulb className="h-5 w-5 mr-2 text-primary" />
            Señales de Trading IA
          </CardTitle>
          <CardDescription>Generando señales, por favor espera...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted"></div>
          <div className="h-20 w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al Generar Señales</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!signalData) {
    return (
      <Alert className="mt-4 border-primary/50 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Aún No Se Han Generado Señales</AlertTitle>
        <AlertDescription>
          Configura los parámetros y haz clic en "Generar Señales de Trading" para ver las recomendaciones de la IA.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (parseError) {
     return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error de Visualización de Señal</AlertTitle>
        <AlertDescription>{parseError}</AlertDescription>
      </Alert>
    );
  }


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-primary">
          <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
          Señales de Trading IA Generadas
        </CardTitle>
        <CardDescription>Revisa las señales de trading y el análisis proporcionados por la IA a continuación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <Terminal className="h-5 w-5 mr-2 text-muted-foreground" />
            Señales Generadas
          </h3>
          {parsedSignals && parsedSignals.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Señal</TableHead>
                    <TableHead className="text-right">Confianza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedSignals.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge
                          variant={item.signal === 'BUY' ? 'default' : item.signal === 'SELL' ? 'destructive' : 'secondary'}
                          className={
                            item.signal === 'BUY' ? 'bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-400' :
                            item.signal === 'SELL' ? 'bg-red-500/20 text-red-700 dark:bg-red-700/30 dark:text-red-400' :
                            'bg-gray-500/20 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400'
                          }
                        >
                          {getSignalBadgeText(item.signal)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{(item.confidence * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No se generaron señales de trading específicas, o las señales no pudieron ser analizadas.</p>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <Lightbulb className="h-5 w-5 mr-2 text-muted-foreground" />
            Explicación
          </h3>
          <div className="p-4 bg-muted/50 rounded-md border text-sm leading-relaxed">
            {signalData.explanation || "No se proporcionó explicación."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

