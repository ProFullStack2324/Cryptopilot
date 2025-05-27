
"use client";

import { useState } from "react";
import type { AISignalData } from "@/lib/types";
import { AppHeader } from "@/components/dashboard/header";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { TradeHistoryTable } from "@/components/dashboard/trade-history-table";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { BotControls } from "@/components/dashboard/bot-controls";
import { SignalDisplay } from "@/components/dashboard/signal-display";
import { handleGenerateSignalsAction } from "./actions"; 
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

  const generateSignalsActionWrapper = async (input: any) => {
    setIsLoadingAiSignals(true);
    setAiError(null); 
    try {
      return await handleGenerateSignalsAction(input);
    } finally {
      // setIsLoadingAiSignals(false); // Esto se maneja en los callbacks ahora
    }
  };


  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1 p-4 md:p-6 lg:p-8 container mx-auto">
        <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-12">
          
          <div className="lg:col-span-12 xl:col-span-4">
            <BalanceCard />
          </div>

          <div className="lg:col-span-12 xl:col-span-8">
            <PerformanceChart />
          </div>
          
          <div className="lg:col-span-12 xl:col-span-6">
            <BotControls 
              onSignalsGenerated={handleSignalsGenerated} 
              onGenerationError={handleGenerationError}
              clearSignalData={clearSignalData}
              generateSignalsAction={generateSignalsActionWrapper} 
            />
          </div>

          <div className="lg:col-span-12 xl:col-span-6">
            <SignalDisplay 
              signalData={aiSignalData} 
              isLoading={isLoadingAiSignals}
              error={aiError}
            />
          </div>
          
          <div className="lg:col-span-12">
            <TradeHistoryTable />
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()} CryptoPilot. Todos los derechos reservados. Plataforma de simulación.
      </footer>
    </div>
  );
}
