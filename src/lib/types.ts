import type { ChartConfig } from "@/components/ui/chart";

export interface Trade {
  id: string;
  date: string;
  type: 'Buy' | 'Sell';
  asset: string;
  amount: number;
  price: number;
  total: number;
  status: 'Filled' | 'Pending' | 'Failed';
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
}

export const mockPerformanceChartConfig = {
  value: {
    label: "Portfolio Value (USD)",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;


export interface SignalItem {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

export interface AISignalData {
  signals: string; // This will be a JSON string of SignalItem[]
  explanation: string;
}

// This type is for the parsed signals string
export type ParsedSignals = SignalItem[];
