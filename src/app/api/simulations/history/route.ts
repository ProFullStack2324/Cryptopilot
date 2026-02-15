// src/app/api/simulations/history/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function GET(req: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("cryptopilot_db");
    const collection = db.collection("simulation_logs");

    // Buscar todas las simulaciones que están cerradas y ordenarlas por fecha de inicio descendente
    const closedSimulations = await collection.find({ status: 'closed' }).sort({ startedAt: -1 }).limit(100).toArray();

    return NextResponse.json({ success: true, simulations: closedSimulations }, { status: 200 });

  } catch (error: any) {
    console.error("[API/Simulations/History] Error fetching simulation history:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch simulation history.', details: error.message }, { status: 500 });
  }
}
