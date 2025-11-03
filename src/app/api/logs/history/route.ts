// src/app/api/logs/history/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function GET(req: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("cryptopilot_db");
    const collection = db.collection("trade_logs");

    // Buscar todos los logs, ordenarlos por fecha descendente y limitar a los últimos 100
    const tradeLogs = await collection.find({}).sort({ serverTimestamp: -1 }).limit(100).toArray();

    return NextResponse.json({ success: true, logs: tradeLogs }, { status: 200 });

  } catch (error: any) {
    console.error("[API/Logs/History] Error fetching trade logs:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch trade logs.', details: error.message }, { status: 500 });
  }
}
