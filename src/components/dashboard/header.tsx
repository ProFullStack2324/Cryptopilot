
"use client";

import { useState, useEffect } from 'react';
import { Bot, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Wallet, Power, Bitcoin as BitcoinIcon } from 'lucide-react'; // Added BitcoinIcon
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  toggleLeftSidebar: () => void;
  isLeftSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  isRightSidebarOpen: boolean;
  portfolioBalance: number | null;
  isBotRunning: boolean;
  toggleBotStatus: () => void;
}

const BITCOIN_PRICE_UPDATE_INTERVAL_MS = 60000; // Actualizar cada 60 segundos

export function AppHeader({
  toggleLeftSidebar,
  isLeftSidebarOpen,
  toggleRightSidebar,
  isRightSidebarOpen,
  portfolioBalance,
  isBotRunning,
  toggleBotStatus
}: AppHeaderProps) {
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [isLoadingBitcoinPrice, setIsLoadingBitcoinPrice] = useState(true);
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  const fetchBitcoinPrice = async () => {
    // No necesitamos setIsLoadingBitcoinPrice(true) en cada fetch, solo al inicio.
    // Si se quiere un indicador de carga para cada actualización, se puede añadir aquí.
    setBitcoinPriceError(null);
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) {
        throw new Error(`Error al obtener precio de BTC: ${response.status}`);
      }
      const data = await response.json();
      if (data.bitcoin && data.bitcoin.usd) {
        setBitcoinPrice(data.bitcoin.usd);
      } else {
        throw new Error('Respuesta inesperada de la API de CoinGecko');
      }
    } catch (error) {
      console.error("Error fetching Bitcoin price:", error);
      setBitcoinPriceError(error instanceof Error ? error.message : 'Error desconocido');
      // Podríamos decidir mantener el precio anterior o ponerlo a null
      // setBitcoinPrice(null); 
    } finally {
      setIsLoadingBitcoinPrice(false); // Solo la primera vez o si queremos resetear en error
    }
  };

  useEffect(() => {
    fetchBitcoinPrice(); // Carga inicial
    const intervalId = setInterval(fetchBitcoinPrice, BITCOIN_PRICE_UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId); // Limpiar intervalo al desmontar
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 md:hidden">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 hidden md:inline-flex">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>

        <div className="mr-4 flex items-center">
          <Bot className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CryptoPilot</h1>
        </div>

        <Button
          variant={isBotRunning ? "destructive" : "default"}
          onClick={toggleBotStatus}
          size="sm"
          className="font-semibold hidden sm:inline-flex mx-4"
        >
          <Power className="mr-2 h-4 w-4" />
          {isBotRunning ? "Detener Bot" : "Iniciar Bot"}
        </Button>

        <div className="ml-auto flex items-center gap-3">
          {/* Bitcoin Price Indicator */}
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground p-2 rounded-md bg-card/50 border border-border shadow-sm">
            <BitcoinIcon className="h-5 w-5 text-yellow-500" />
            {isLoadingBitcoinPrice ? (
              <span className="text-muted-foreground text-xs">Cargando BTC...</span>
            ) : bitcoinPrice !== null ? (
              <span>
                BTC/USD: ${bitcoinPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            ) : (
              <span className="text-red-500 text-xs" title={bitcoinPriceError || undefined}>Error BTC</span>
            )}
          </div>

          {portfolioBalance !== null ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground p-2 rounded-md bg-card/50 border border-border shadow-sm">
              <Wallet className="h-5 w-5 text-accent" />
              <span>
                {portfolioBalance.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground p-2 rounded-md bg-muted/50 border border-border shadow-sm">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Cargando saldo...</span>
            </div>
          )}

          <span className="text-xs text-muted-foreground hidden sm:inline border-l pl-3">Entorno de Simulación</span>

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
