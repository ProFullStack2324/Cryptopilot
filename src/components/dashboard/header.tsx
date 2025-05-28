
"use client";

import { Bot, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Wallet, Power, Bitcoin as BitcoinIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice"; // Importar el hook

interface AppHeaderProps {
  toggleLeftSidebar: () => void;
  isLeftSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  isRightSidebarOpen: boolean;
  portfolioBalance: number | null;
  isBotRunning: boolean;
  toggleBotStatus: () => void;
}

export function AppHeader({
  toggleLeftSidebar,
  isLeftSidebarOpen,
  toggleRightSidebar,
  isRightSidebarOpen,
  portfolioBalance,
  isBotRunning,
  toggleBotStatus
}: AppHeaderProps) {
  const { bitcoinPrice, isLoadingBitcoinPrice, bitcoinPriceError } = useBitcoinPrice(); // Usar el hook

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 md:hidden">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 hidden md:inline-flex">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>

        <div className="mr-4 hidden items-center md:flex">
          <Bot className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CryptoPilot</h1>
        </div>
        
        <div className="flex items-center md:hidden mr-auto">
            <Bot className="h-7 w-7 mr-2 text-primary" />
            <h1 className="text-xl font-bold text-foreground">CryptoPilot</h1>
        </div>

        <Button
          variant={isBotRunning ? "destructive" : "default"}
          onClick={toggleBotStatus}
          size="sm"
          className="font-semibold hidden sm:inline-flex mx-2 md:mx-4"
        >
          <Power className="mr-2 h-4 w-4" />
          {isBotRunning ? "Detener Bot" : "Iniciar Bot"}
        </Button>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-semibold text-foreground p-1.5 md:p-2 rounded-md bg-card/50 border border-border shadow-sm">
            <BitcoinIcon className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" />
            {isLoadingBitcoinPrice ? (
              <span className="text-muted-foreground text-xs">Cargando BTC...</span>
            ) : bitcoinPrice !== null ? (
              <>
                <span className="hidden sm:inline">
                  BTC/USD: ${bitcoinPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="sm:hidden">
                    BTC: ${bitcoinPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </>
            ) : (
              <span className="text-red-500 text-xs" title={bitcoinPriceError || "No se pudo cargar el precio de BTC"}>Error BTC</span>
            )}
          </div>

          {portfolioBalance !== null ? (
            <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-semibold text-foreground p-1.5 md:p-2 rounded-md bg-card/50 border border-border shadow-sm">
              <Wallet className="h-4 w-4 md:h-5 md:w-5 text-accent" />
              <span className="hidden sm:inline">
                {portfolioBalance.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
               <span className="sm:hidden">
                {`$${(portfolioBalance / 1000).toFixed(1)}k`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground p-2 rounded-md bg-muted/50 border border-border shadow-sm">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Cargando saldo...</span>
            </div>
          )}

          <span className="text-xs text-muted-foreground hidden xl:inline border-l pl-3 ml-1">Entorno de Simulación</span>

          <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="hidden md:inline-flex">
            {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            <span className="sr-only">Alternar barra lateral derecha</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="md:hidden">
            {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            <span className="sr-only">Alternar barra lateral derecha</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
