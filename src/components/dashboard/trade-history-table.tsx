
import type { Trade } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react"; 


interface TradeHistoryTableProps {
  trades: Trade[];
}

const translateTradeTypeToSpanish = (type: 'Compra' | 'Venta'): string => {
  return type; 
};

const translateTradeStatusToSpanish = (status: 'Completado' | 'Pendiente' | 'Fallido'): string => {
  return status; 
};

const getStatusBadgeVariant = (status: 'Completado' | 'Pendiente' | 'Fallido'): "default" | "secondary" | "destructive" => {
  if (status === 'Completado') return 'default';
  if (status === 'Pendiente') return 'secondary';
  return 'destructive';
}

const getStatusBadgeStyle = (status: 'Completado' | 'Pendiente' | 'Fallido'): string => {
  if (status === 'Completado') return 'bg-green-500/80 text-green-50 border-green-700';
  if (status === 'Pendiente') return 'bg-yellow-500/80 text-yellow-50 border-yellow-700'; 
  return 'bg-red-500/80 text-red-50 border-red-700';
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  return (
    <Card className="shadow-lg bg-card text-card-foreground flex flex-col h-[calc(100%-1rem)] md:h-auto"> {/* Ajustar altura para consistencia */}
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center text-primary">
          <History className="h-4 w-4 mr-2" />
          Historial de Operaciones
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Últimas operaciones (simuladas).</CardDescription>
      </CardHeader>
      <CardContent className="overflow-y-auto pt-0 flex-grow pb-2">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No hay operaciones en el historial.
          </div>
        ) : (
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            <TableRow>
              <TableHead className="text-xs text-muted-foreground py-1.5 px-2">Fecha</TableHead>
              <TableHead className="text-xs text-muted-foreground py-1.5 px-2">Tipo</TableHead>
              <TableHead className="text-xs text-muted-foreground py-1.5 px-2">Activo</TableHead>
              <TableHead className="text-right text-xs text-muted-foreground py-1.5 px-2">Total</TableHead>
              <TableHead className="text-center text-xs text-muted-foreground py-1.5 px-2">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id} className="hover:bg-muted/20">
                <TableCell className="font-mono text-[0.7rem] text-foreground/90 py-1.5 px-2 whitespace-nowrap">
                  
                  {trade.date.split(',')[0].trim() + (trade.date.split(',')[1] ? ', ' + trade.date.split(',')[1].trim().slice(0,5) : '')}
                </TableCell>
                <TableCell className="py-1.5 px-2">
                  <Badge 
                    variant={trade.type === 'Compra' ? 'default' : 'destructive'}
                    className={`font-semibold text-[0.65rem] py-0.5 px-1.5 ${trade.type === 'Compra' ? 'bg-green-500/80 text-green-50 hover:bg-green-500/90 border-green-700' : 'bg-red-500/80 text-red-50 hover:bg-red-500/90 border-red-700'}`}
                  >
                    {translateTradeTypeToSpanish(trade.type)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-xs text-foreground py-1.5 px-2">{trade.asset}</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold text-foreground py-1.5 px-2">
                  {trade.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </TableCell>
                <TableCell className="text-center py-1.5 px-2">
                   <Badge 
                     variant={getStatusBadgeVariant(trade.status)}
                     className={`font-semibold text-[0.65rem] py-0.5 px-1.5 ${getStatusBadgeStyle(trade.status)}`}
                    >
                    {translateTradeStatusToSpanish(trade.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
}
