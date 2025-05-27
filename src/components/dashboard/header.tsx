
import { Bot, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose, Wallet, Power } from 'lucide-react';
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

export function AppHeader({ 
  toggleLeftSidebar, 
  isLeftSidebarOpen, 
  toggleRightSidebar, 
  isRightSidebarOpen, 
  portfolioBalance,
  isBotRunning,
  toggleBotStatus
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        {/* Botón para móvil o si se quiere siempre (Izquierda) */}
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 md:hidden">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>
         {/* Botón para escritorio (Izquierda) */}
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 hidden md:inline-flex">
          {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          <span className="sr-only">Alternar barra lateral izquierda</span>
        </Button>
        
        <div className="mr-4 flex items-center">
          <Bot className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CryptoPilot</h1>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
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
                    <span>Cargando saldo...</span>
                </div>
            )}

            <Button
                variant={isBotRunning ? "destructive" : "default"}
                onClick={toggleBotStatus}
                size="sm"
                className="font-semibold hidden sm:inline-flex" // Ocultar en pantallas muy pequeñas si es necesario
              >
                <Power className="mr-2 h-4 w-4" />
                {isBotRunning ? "Detener Bot" : "Iniciar Bot"}
            </Button>
            
            <span className="text-xs text-muted-foreground hidden sm:inline border-l pl-3">Entorno de Simulación</span>
            
            {/* Botón para escritorio (Derecha) */}
            <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="hidden md:inline-flex">
              {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              <span className="sr-only">Alternar barra lateral derecha</span>
            </Button>
            {/* Botón para móvil (Derecha) */}
             <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="md:hidden">
              {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              <span className="sr-only">Alternar barra lateral derecha</span>
            </Button>
        </div>
      </div>
    </header>
  );
}
