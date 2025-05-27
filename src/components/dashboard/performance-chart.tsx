"use client"

import { TrendingUp } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { PerformanceDataPoint } from "@/lib/types";
import { mockPerformanceChartConfig } from "@/lib/types";
import { useState, useEffect } from 'react';

const initialPerformanceData: PerformanceDataPoint[] = [
  { date: 'Jul 01', value: 9500 },
  { date: 'Jul 03', value: 9700 },
  { date: 'Jul 05', value: 9650 },
  { date: 'Jul 07', value: 10050 },
  { date: 'Jul 09', value: 10200 },
  { date: 'Jul 11', value: 10150 },
  { date: 'Jul 13', value: 10300 },
  { date: 'Jul 15', value: 10500 },
];


export function PerformanceChart() {
  const [chartData, setChartData] = useState<PerformanceDataPoint[] | null>(null);

  useEffect(() => {
    // Simulate fetching chart data
    setChartData(initialPerformanceData);
  }, []);

  if (chartData === null) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
           <div className="h-full w-full animate-pulse rounded-md bg-muted"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          Portfolio Performance
        </CardTitle>
        <CardDescription>Portfolio value over the last 15 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={mockPerformanceChartConfig} className="h-[300px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
              top: 5,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 6)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${(value / 1000)}k`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={3}
              dot={true}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
       <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          Current portfolio value is ${chartData[chartData.length -1].value.toLocaleString()}.
        </div>
        <div className="leading-none text-muted-foreground">
          Showing data for the last 15 days.
        </div>
      </CardFooter>
    </Card>
  )
}
