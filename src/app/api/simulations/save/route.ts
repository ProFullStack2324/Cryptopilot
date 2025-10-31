// src/app/api/simulations/save/route.ts
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb-client';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const client = await clientPromise;
    const db = client.db("cryptopilot_db");
    const collection = db.collection("simulation_logs");

    if (data.simulationId) {
      // Si hay un ID, es una actualización (fin de la simulación)
      const { simulationId, ...updateData } = data;
      const result = await collection.updateOne(
        { _id: new ObjectId(simulationId) },
        { $set: { ...updateData, status: 'closed', closedAt: new Date() } }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ success: false, message: 'Simulation ID not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Simulation log updated successfully.' }, { status: 200 });

    } else {
      // Si no hay ID, es una inserción (inicio de la simulación)
      const simulationToInsert = {
        ...data,
        status: 'open',
        startedAt: new Date(),
      };
      const result = await collection.insertOne(simulationToInsert);
      return NextResponse.json({ success: true, message: 'Simulation log started.', insertedId: result.insertedId }, { status: 201 });
    }

  } catch (error: any) {
    console.error("[API/Simulations/Save] Error saving simulation to MongoDB:", error);
    return NextResponse.json({ success: false, message: 'Failed to save simulation.', details: error.message }, { status: 500 });
  }
}
