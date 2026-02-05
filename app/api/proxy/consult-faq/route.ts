
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
        }

        const body = await req.json();
        const { agent_id } = body; // Retell envía esto

        console.log(`[Consult FAQ] Received request for Agent: ${agent_id}`);

        if (!agent_id) {
            return NextResponse.json({ success: false, info: "No agent_id provided." });
        }

        // Buscamos el subworkspace que tenga este retell_agent_id
        const snapshot = await adminDb.collection('subworkspaces')
            .where('retell_agent_id', '==', agent_id)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.warn(`[Consult FAQ] Agent not found in DB: ${agent_id}`);
            return NextResponse.json({ success: true, info: "No knowledge base found for this agent." });
        }

        const docData = snapshot.docs[0].data();
        const content = docData.knowledge_base || "No hay información adicional configurada para este agente.";

        // console.log(`[Consult FAQ] Found content length: ${content.length}`);

        return NextResponse.json({
            success: true,
            info: content
        });

    } catch (error: any) {
        console.error("[Consult FAQ] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
