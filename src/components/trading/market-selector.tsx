
"use client";

import type { Market } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTree } from "lucide-react";

interface MarketSelectorProps {
  markets: Market[];
  selectedMarketId: string;
  onMarketChange: (marketId: string) => void;
}

export function MarketSelector({ markets, selectedMarketId, onMarketChange }: MarketSelectorProps) {
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg flex items-center">
          <ListTree className="h-5 w-5 mr-2 text-primary" />
          Mercados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedMarketId} onValueChange={onMarketChange}>
          <SelectTrigger className="w-full bg-input text-foreground">
            <SelectValue placeholder="Selecciona un mercado" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            {markets.map((market) => (
              <SelectItem key={market.id} value={market.id}>
                <div className="flex justify-between items-center w-full">
                  <span>{market.name}</span>
                  {market.latestPrice && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ${market.latestPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
