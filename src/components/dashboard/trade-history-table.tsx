import type { Trade } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

const mockTrades: Trade[] = [
  { id: '1', date: '2024-07-15', type: 'Buy', asset: 'BTC/USD', amount: 0.005, price: 62000, total: 310, status: 'Filled' },
  { id: '2', date: '2024-07-14', type: 'Sell', asset: 'ETH/USD', amount: 0.1, price: 3400, total: 340, status: 'Filled' },
  { id: '3', date: '2024-07-13', type: 'Buy', asset: 'SOL/USD', amount: 2, price: 150, total: 300, status: 'Pending' },
  { id: '4', date: '2024-07-12', type: 'Buy', asset: 'BTC/USD', amount: 0.002, price: 61500, total: 123, status: 'Filled' },
  { id: '5', date: '2024-07-11', type: 'Sell', asset: 'ADA/USD', amount: 100, price: 0.40, total: 40, status: 'Failed' },
];

export function TradeHistoryTable() {
  return (
    <Card className="shadow-lg col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Trade History</CardTitle>
        <History className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Price (USD)</TableHead>
              <TableHead className="text-right">Total (USD)</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTrades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell>{trade.date}</TableCell>
                <TableCell>
                  <Badge variant={trade.type === 'Buy' ? 'default' : 'secondary'} 
                         className={trade.type === 'Buy' ? 'bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-700 dark:bg-red-700/30 dark:text-red-400 hover:bg-red-500/30'}>
                    {trade.type}
                  </Badge>
                </TableCell>
                <TableCell>{trade.asset}</TableCell>
                <TableCell className="text-right">{trade.amount.toFixed(trade.asset.includes('BTC') ? 5 : 2)}</TableCell>
                <TableCell className="text-right">{trade.price.toLocaleString()}</TableCell>
                <TableCell className="text-right">{trade.total.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                   <Badge variant={trade.status === 'Filled' ? 'default' : trade.status === 'Pending' ? 'outline' : 'destructive'}
                          className={
                            trade.status === 'Filled' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                            trade.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }>
                    {trade.status}
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
