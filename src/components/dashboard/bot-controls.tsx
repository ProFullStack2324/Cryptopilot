// src/components/dashboard/bot-controls.tsx
"use client"

import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";

interface BotControlsProps {
  isBotRunning: boolean;
  onToggleBot: () => void; 
}

export function BotControls({ isBotRunning, onToggleBot }: BotControlsProps) {
  return (
    <Button
        onClick={onToggleBot}
        className={`px-6 py-3 rounded-lg font-semibold ${isBotRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors duration-200`}
    >
        {isBotRunning ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
        {isBotRunning ? 'Detener Bot' : 'Iniciar Bot'}
    </Button>
  );
}
