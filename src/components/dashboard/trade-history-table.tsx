
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
import { History, ListCollapse } from "lucide-react";

const mockTrades: Trade[] = [
  { id: '1', date: '2024-07-15 10:30', type: 'Buy', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Filled' },
  { id: '2', date: '2024-07-14 15:45', type: 'Sell', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Filled' },
  { id: '3', date: '2024-07-13 09:12', type: 'Buy', asset: 'SOL/USD', amount: 2, price: 150, total: 300, status: 'Pending' },
  { id: '4', date: '2024-07-12 18:05', type: 'Buy', asset: 'BTC/USD', amount: 0.002, price: 61500, total: 123, status: 'Filled' },
  { id: '5', date: '2024-07-11 11:50', type: 'Sell', asset: 'ADA/USD', amount: 100, price: 0.40, total: 40, status: 'Failed' },
  { id: '6', date: '2024-07-10 22:15', type: 'Buy', asset: 'ETH/USD', amount: 0.05, price: 3350, total: 167.50, status: 'Filled' },
];

const translateTradeType = (type: 'Buy' | 'Sell'): string => {
  switch (type) {
    case 'Buy': return 'Compra';
    case 'Sell': return 'Venta';
    default: return type;
  }
};

const translateTradeStatus = (status: 'Filled' | 'Pending' | 'Failed'): string => {
  switch (status) {
    case 'Filled': return 'Completado';
    case 'Pending': return 'Pendiente';
    case 'Failed': return 'Fallido';
    default: return status;
  }
};

const getStatusBadgeVariant = (status: 'Filled' | 'Pending' | 'Failed'): "default" | "secondary" | "destructive" => {
  if (status === 'Filled') return 'default';
  if (status === 'Pending') return 'secondary';
  return 'destructive';
}

const getStatusBadgeStyle = (status: 'Filled' | 'Pending' | 'Failed'): string => {
  if (status === 'Filled') return 'bg-green-500/80 text-green-50 border-green-700';
  if (status === 'Pending') return 'bg-yellow-500/80 text-yellow-50 border-yellow-700';
  return 'bg-red-500/80 text-red-50 border-red-700';
}

export function TradeHistoryTable() {
  return (
    <Card className="shadow-lg bg-card text-card-foreground col-span-1 lg:col-span-3 xl:col-span-4">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center text-primary">
          <History className="h-5 w-5 mr-2" />
          Historial de Operaciones
        </CardTitle>
        <CardDescription className="text-muted-foreground">Últimas operaciones realizadas por el bot o manualmente.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-muted-foreground">Fecha y Hora</TableHead>
              <TableHead className="text-muted-foreground">Tipo</TableHead>
              <TableHead className="text-muted-foreground">Activo</TableHead>
              <TableHead className="text-right text-muted-foreground">Cantidad</TableHead>
              <TableHead className="text-right text-muted-foreground">Precio (USD)</TableHead>
              <TableHead className="text-right text-muted-foreground">Total (USD)</TableHead>
              <TableHead className="text-center text-muted-foreground">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTrades.map((trade) => (
              <TableRow key={trade.id} className="hover:bg-muted/20">
                <TableCell className="font-mono text-xs text-foreground/90">{trade.date}</TableCell>
                <TableCell>
                  <Badge 
                    variant={trade.type === 'Buy' ? 'default' : 'destructive'}
                    className={`font-semibold text-xs py-1 px-2 ${trade.type === 'Buy' ? 'bg-green-500/80 text-green-50 hover:bg-green-500/90 border-green-700' : 'bg-red-500/80 text-red-50 hover:bg-red-500/90 border-red-700'}`}
                  >
                    {translateTradeType(trade.type)}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{trade.asset}</TableCell>
                <TableCell className="text-right font-mono text-xs text-foreground/90">{trade.amount.toFixed(trade.asset.includes('BTC') ? 5 : 2)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-foreground/90">{trade.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold text-foreground">{trade.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                <TableCell className="text-center">
                   <Badge 
                     variant={getStatusBadgeVariant(trade.status)}
                     className={`font-semibold text-xs py-1 px-2 ${getStatusBadgeStyle(trade.status)}`}
                    >
                    {translateTradeStatus(trade.status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
