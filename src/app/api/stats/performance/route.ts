// src/app/api/stats/performance/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function GET(req: Request) {
    try {
        const client = await clientPromise;
        const db = client.db("cryptopilot_db");

        // --- 1. Analizar Operaciones Reales ---
        const tradeLogsCollection = db.collection("trade_logs");
        const realTrades = await tradeLogsCollection.find({ "details.fills": { $exists: true, $ne: [] } }).toArray();

        let realGains = 0;
        let realLosses = 0;
        let winningRealTrades = 0;
        const processedRealTrades = new Map();

        // Esta lógica asume una estrategia simple de 1 compra -> 1 venta.
        // Se puede mejorar para manejar múltiples compras antes de una venta.
        const buyTrades = realTrades.filter(t => t.details?.side === 'buy');
        const sellTrades = realTrades.filter(t => t.details?.side === 'sell');

        buyTrades.forEach(buy => {
            const correspondingSell = sellTrades.find(sell => sell.details.symbol === buy.details.symbol && sell.timestamp > buy.timestamp && !processedRealTrades.has(sell._id.toString()));
            if (correspondingSell) {
                const entryCost = parseFloat(buy.details.cummulativeQuoteQty);
                const exitValue = parseFloat(correspondingSell.details.cummulativeQuoteQty);
                const pnl = exitValue - entryCost;

                if (pnl > 0) {
                    realGains += pnl;
                    winningRealTrades++;
                } else {
                    realLosses += Math.abs(pnl);
                }
                processedRealTrades.set(correspondingSell._id.toString(), true); // Marcar venta como procesada
            }
        });

        // --- 2. Analizar Simulaciones ---
        const simulationLogsCollection = db.collection("simulation_logs");
        const simulations = await simulationLogsCollection.find({ status: 'closed', finalPnl: { $exists: true } }).toArray();
        
        let simulatedGains = 0;
        let simulatedLosses = 0;
        let winningSimulatedTrades = 0;

        simulations.forEach(sim => {
            if (sim.finalPnl > 0) {
                simulatedGains += sim.finalPnl;
                winningSimulatedTrades++;
            } else {
                simulatedLosses += Math.abs(sim.finalPnl);
            }
        });

        // --- 3. Calcular Métricas Totales ---
        const totalRealTrades = processedRealTrades.size;
        const totalSimulatedTrades = simulations.length;
        const totalTrades = totalRealTrades + totalSimulatedTrades;
        const winningTrades = winningRealTrades + winningSimulatedTrades;

        const effectivenessRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        const metrics = {
            simulatedGains,
            simulatedLosses,
            simulatedNet: simulatedGains - simulatedLosses,
            realGains,
            realLosses,
            realNet: realGains - realLosses,
            effectivenessRate,
            totalTrades,
            winningTrades,
        };

        return NextResponse.json(metrics, { status: 200 });

    } catch (error: any) {
        console.error("[API/Stats/Performance] Error calculating performance metrics:", error);
        return NextResponse.json({ success: false, message: 'Failed to calculate metrics.', details: error.message }, { status: 500 });
    }
}
