
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Bot, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Wallet, Power, Bitcoin as BitcoinIcon } from 'lucide-react';
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
  const [isLoadingBitcoinPrice, setIsLoadingBitcoinPrice] = useState(true); // Solo true al inicio
  const [bitcoinPriceError, setBitcoinPriceError] = useState<string | null>(null);

  const fetchBitcoinPrice = useCallback(async () => {
    // No establecer isLoadingBitcoinPrice a true aquí en cada fetch
    // setBitcoinPriceError(null); // Se maneja mejor si solo se limpia en caso de éxito
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) {
        let errorDetails = `Error API CoinGecko: ${response.status}`;
        try {
            const errorData = await response.text();
            errorDetails += ` - ${errorData}`;
        } catch (e) {
            // No hacer nada si no se puede leer el cuerpo del error
        }
        console.error(errorDetails);
        throw new Error(errorDetails);
      }
      const data = await response.json();
      if (data.bitcoin && data.bitcoin.usd) {
        setBitcoinPrice(data.bitcoin.usd);
        setBitcoinPriceError(null); // Limpiar error si fue exitoso
      } else {
        console.error('Respuesta de API CoinGecko inesperada:', data);
        throw new Error('Respuesta de API CoinGecko inesperada');
      }
    } catch (error) {
      console.error("Error al obtener precio de Bitcoin:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener precio BTC';
      setBitcoinPriceError(errorMessage);
      setBitcoinPrice(null); 
    } finally {
      // Solo poner isLoadingBitcoinPrice a false si era la carga inicial
      if (isLoadingBitcoinPrice) {
        setIsLoadingBitcoinPrice(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingBitcoinPrice]); // isLoadingBitcoinPrice se usa en el finally, es correcto aquí

  useEffect(() => {
    // setIsLoadingBitcoinPrice(true); // Ya se inicializa a true
    fetchBitcoinPrice(); // Carga inicial
    const intervalId = setInterval(fetchBitcoinPrice, BITCOIN_PRICE_UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId); 
  }, [fetchBitcoinPrice]); // fetchBitcoinPrice es la dependencia correcta aquí

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
          {/* Bitcoin Price Indicator */}
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
