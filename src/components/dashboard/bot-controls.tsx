"use client"

import { useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { GenerateTradingSignalsInput, GenerateTradingSignalsOutput } from "@/ai/flows/generate-trading-signals";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Power, Settings2, DollarSign, Repeat, Waypoints, ShieldCheck, Sparkles, Loader2 } from "lucide-react";

const exampleHistoricalData = JSON.stringify([
  {"timestamp": "2023-10-01T00:00:00Z", "open": 27000, "high": 27200, "low": 26800, "close": 27100, "volume": 1000},
  {"timestamp": "2023-10-02T00:00:00Z", "open": 27100, "high": 27500, "low": 27000, "close": 27400, "volume": 1200},
  {"timestamp": "2023-10-03T00:00:00Z", "open": 27400, "high": 28000, "low": 27300, "close": 27900, "volume": 1500},
  {"timestamp": "2023-10-04T00:00:00Z", "open": 27900, "high": 28100, "low": 27700, "close": 27800, "volume": 1100},
  {"timestamp": "2023-10-05T00:00:00Z", "open": 27800, "high": 28200, "low": 27500, "close": 28150, "volume": 1300}
], null, 2);

const formSchema = z.object({
  amountPerTrade: z.coerce.number().min(1, "Amount must be at least 1 USD."),
  cryptocurrency: z.string().min(1, "Please select a cryptocurrency."),
  strategy: z.enum(['movingAverage', 'rsi', 'bollingerBands']),
  riskLevel: z.enum(['high', 'medium', 'low']),
  historicalData: z.string().refine(data => {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }, "Historical data must be valid JSON."),
});

type BotControlsFormValues = z.infer<typeof formSchema>;

interface BotControlsProps {
  onSignalsGenerated: (data: GenerateTradingSignalsOutput) => void;
  onGenerationError: (errorMsg: string) => void;
  clearSignalData: () => void;
  generateSignalsAction: (input: GenerateTradingSignalsInput) => Promise<GenerateTradingSignalsOutput>;
}

export function BotControls({ onSignalsGenerated, onGenerationError, clearSignalData, generateSignalsAction }: BotControlsProps) {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<BotControlsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPerTrade: 100,
      cryptocurrency: "BTC",
      strategy: "movingAverage",
      riskLevel: "medium",
      historicalData: exampleHistoricalData,
    },
  });

  const onSubmit: SubmitHandler<BotControlsFormValues> = async (data) => {
    clearSignalData();
    startTransition(async () => {
      try {
        const aiInput: GenerateTradingSignalsInput = {
          historicalData: data.historicalData, // Already a string
          strategy: data.strategy,
          riskLevel: data.riskLevel,
        };
        const result = await generateSignalsAction(aiInput);
        onSignalsGenerated(result);
        toast({
          title: "Signals Generated",
          description: "AI has successfully generated trading signals.",
        });
      } catch (error) {
        console.error("Error generating signals:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        onGenerationError(errorMessage);
        toast({
          title: "Error Generating Signals",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  };

  const toggleBotStatus = () => {
    setIsBotRunning(!isBotRunning);
    toast({
      title: `Bot ${!isBotRunning ? "Started" : "Stopped"}`,
      description: `The trading bot is now ${!isBotRunning ? "running" : "stopped"}.`,
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings2 className="h-5 w-5 mr-2 text-primary" />
          Bot Controls & Strategy
        </CardTitle>
        <CardDescription>Configure the trading bot and generate AI signals.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="bot-status" className="text-sm font-medium">Bot Status</Label>
              <Button
                id="bot-status"
                type="button"
                variant={isBotRunning ? "destructive" : "default"}
                onClick={toggleBotStatus}
                className="w-[120px]"
              >
                <Power className="mr-2 h-4 w-4" />
                {isBotRunning ? "Stop Bot" : "Start Bot"}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="amountPerTrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />Amount per Trade (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cryptocurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Repeat className="h-4 w-4 mr-1 text-muted-foreground" />Cryptocurrency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a cryptocurrency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      <SelectItem value="SOL">Solana (SOL)</SelectItem>
                      <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Waypoints className="h-4 w-4 mr-1 text-muted-foreground" />Trading Strategy</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a strategy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="movingAverage">Moving Average Crossover</SelectItem>
                      <SelectItem value="rsi">RSI (Relative Strength Index)</SelectItem>
                      <SelectItem value="bollingerBands">Bollinger Bands</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="riskLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><ShieldCheck className="h-4 w-4 mr-1 text-muted-foreground" />Risk Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a risk level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="historicalData"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Historical Price Data (JSON)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter historical data as JSON string" {...field} rows={5} className="font-mono text-xs"/>
                  </FormControl>
                  <FormDescription>
                    Paste historical price data. Each object should contain timestamp, open, high, low, close, and volume.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Trading Signals
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
