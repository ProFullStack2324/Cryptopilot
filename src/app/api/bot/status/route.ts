
// src/app/api/bot/status/route.ts
import { NextResponse } from 'next/server';
import tradingService from '@/lib/bot/trading-service';

export async function GET() {
    try {
        const status = tradingService.getStatus();
        return NextResponse.json({ success: true, data: status });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
