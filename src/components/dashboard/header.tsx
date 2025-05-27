
import { Bot } from 'lucide-react'; 

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <Bot className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">CryptoPilot</h1>
        </div>
        {/* La navegación futura o el perfil de usuario pueden ir aquí */}
        <div className="ml-auto">
            <span className="text-xs text-muted-foreground">Entorno de Simulación</span>
        </div>
      </div>
    </header>
  );
}
