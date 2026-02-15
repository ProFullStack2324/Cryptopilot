// src/app/api/logs/save/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function POST(req: Request) {
  try {
    const logData = await req.json();

    if (!logData || typeof logData !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid log data provided.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cryptopilot_db"); // Puedes nombrar tu base de datos como prefieras
    const collection = db.collection("trade_logs"); // Nombre de la colección para los logs

    // Añade una fecha de servidor para un registro más fiable
    const logToInsert = {
      ...logData,
      serverTimestamp: new Date(),
    };

    const result = await collection.insertOne(logToInsert);

    return NextResponse.json({ success: true, message: 'Log saved successfully.', insertedId: result.insertedId }, { status: 201 });

  } catch (error: any) {
    console.error("[API/Logs/Save] Error saving log to MongoDB:", error);
    return NextResponse.json({ success: false, message: 'Failed to save log.', details: error.message }, { status: 500 });
  }
}
