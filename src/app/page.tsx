"use client";

import { useState } from "react";
import type { AISignalData } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TradeHistoryTable } from "@/components/dashboard/trade-history-table";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { BotControls } from "@/components/dashboard/bot-controls";
import { SignalDisplay } from "@/components/dashboard/signal-display";
import { handleGenerateSignalsAction } from "./actions"; // Server Action
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const [aiSignalData, setAiSignalData] = useState<AISignalData | null>(null);
  const [isLoadingAiSignals, setIsLoadingAiSignals] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSignalsGenerated = (data: AISignalData) => {
    setAiSignalData(data);
    setIsLoadingAiSignals(false);
    setAiError(null);
  };

  const handleGenerationError = (errorMsg: string) => {
    setAiSignalData(null);
    setIsLoadingAiSignals(false);
    setAiError(errorMsg);
  };
  
  const clearSignalData = () => {
    setAiSignalData(null);
    setAiError(null);
  }

  // Wrapper for server action to set loading state
  const generateSignalsActionWrapper = async (input: any) => {
    setIsLoadingAiSignals(true);
    setAiError(null); // Clear previous errors
    // setAiSignalData(null); // Clear previous data while loading new
    // No, don't clear previous data yet, BotControls's onSubmit already calls clearSignalData.
    // This wrapper should just manage loading state around the action call.
    try {
      return await handleGenerateSignalsAction(input);
    } finally {
      // setIsLoadingAiSignals(false); // This is handled in callbacks now
    }
  };


  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-8 container mx-auto">
        <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-3 xl:grid-cols-4">
          {/* Top Row: Balance, Performance */}
          <div className="lg:col-span-1 xl:col-span-1">
            <BalanceCard />
          </div>
          <div className="lg:col-span-2 xl:col-span-3">
            <PerformanceChart />
          </div>

          {/* Middle Row: Bot Controls & AI Signals */}
          <div className="lg:col-span-3 xl:col-span-2">
            <BotControls 
              onSignalsGenerated={handleSignalsGenerated} 
              onGenerationError={handleGenerationError}
              clearSignalData={clearSignalData}
              generateSignalsAction={generateSignalsActionWrapper} 
            />
          </div>
          <div className="lg:col-span-3 xl:col-span-2">
            <SignalDisplay 
              signalData={aiSignalData} 
              isLoading={isLoadingAiSignals}
              error={aiError}
            />
          </div>
          
          {/* Bottom Row: Trade History */}
          <div className="lg:col-span-3 xl:col-span-4">
            <TradeHistoryTable />
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} CryptoPilot. All rights reserved.
      </footer>
    </div>
  );
}
