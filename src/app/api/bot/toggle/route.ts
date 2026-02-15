import { NextResponse } from 'next/server';
import tradingService from '@/lib/bot/trading-service';
import { z } from 'zod';

const ToggleBotSchema = z.object({
    action: z.enum(['start', 'stop']),
    market: z.object({
        symbol: z.string(),
        id: z.string()
    }).optional(),
    timeframe: z.string().optional()
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const validation = ToggleBotSchema.safeParse(body);
        
        if (!validation.success) {
            return NextResponse.json({ 
                success: false, 
                message: 'Datos de entrada inválidos', 
                errors: validation.error.format() 
            }, { status: 400 });
        }

        const { action, market, timeframe } = validation.data;

        if (action === 'start') {
            if (!market) {
                return NextResponse.json({ success: false, message: 'Se requiere un mercado para iniciar' }, { status: 400 });
            }
            await tradingService.start(market as any, timeframe || '5m');
            return NextResponse.json({ success: true, message: 'Bot iniciado correctamente' });
        } else if (action === 'stop') {
            tradingService.stop();
            return NextResponse.json({ success: true, message: 'Bot detenido correctamente' });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
