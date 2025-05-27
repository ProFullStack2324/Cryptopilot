
import { Bot, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose } from 'lucide-react'; 
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  toggleLeftSidebar: () => void;
  isLeftSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  isRightSidebarOpen: boolean;
}

export function AppHeader({ toggleLeftSidebar, isLeftSidebarOpen, toggleRightSidebar, isRightSidebarOpen }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="mr-2 md:hidden"> {/* Botón para móvil o si se quiere siempre */}
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
        
        <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Entorno de Simulación</span>
            <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="hidden md:inline-flex">
              {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              <span className="sr-only">Alternar barra lateral derecha</span>
            </Button>
             <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="md:hidden"> {/* Botón para móvil */}
              {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              <span className="sr-only">Alternar barra lateral derecha</span>
            </Button>
        </div>
      </div>
    </header>
  );
}
