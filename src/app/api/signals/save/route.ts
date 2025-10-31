// src/app/api/signals/save/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';

export async function POST(req: Request) {
  try {
    const signalData = await req.json();

    if (!signalData || typeof signalData !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid signal data provided.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cryptopilot_db");
    const collection = db.collection("signal_logs"); // Nueva colección para las señales

    // Añade una fecha de servidor para un registro más fiable
    const signalToInsert = {
      ...signalData,
      serverTimestamp: new Date(),
    };

    const result = await collection.insertOne(signalToInsert);

    return NextResponse.json({ success: true, message: 'Signal saved successfully.', insertedId: result.insertedId }, { status: 201 });

  } catch (error: any) {
    console.error("[API/Signals/Save] Error saving signal to MongoDB:", error);
    return NextResponse.json({ success: false, message: 'Failed to save signal.', details: error.message }, { status: 500 });
  }
}
