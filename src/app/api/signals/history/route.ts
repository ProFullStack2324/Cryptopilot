// src/app/api/signals/history/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function GET(req: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("cryptopilot_db");
    const collection = db.collection("signal_logs");

    // Buscar todos los logs de señales, ordenarlos por fecha descendente y limitar a los últimos 100
    const signalLogs = await collection.find({}).sort({ serverTimestamp: -1 }).limit(100).toArray();

    return NextResponse.json({ success: true, logs: signalLogs }, { status: 200 });

  } catch (error: any) {
    console.error("[API/Signals/History] Error fetching signal logs:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch signal logs.', details: error.message }, { status: 500 });
  }
}
