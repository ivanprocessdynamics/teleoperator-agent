
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        if (!adminDb) {
            console.error("[Consult FAQ] Admin DB is not initialized");
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        const body = await req.json();
        const { agent_id } = body;

        console.log(`[Consult FAQ] Received request for agent_id: ${agent_id}`);

        if (!agent_id) {
            console.warn("[Consult FAQ] Missing agent_id in request body");
            // Según requerimiento: si es desconocido (o no viene), error.
            return NextResponse.json({ error: "Missing agent_id" }, { status: 400 });
        }

        // Lógica de búsqueda dinámica (soporta 'satflow' si existe en DB con ese retell_agent_id)
        const snapshot = await adminDb.collection('subworkspaces')
            .where('retell_agent_id', '==', agent_id)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.warn(`[Consult FAQ] Agent ID '${agent_id}' not found in subworkspaces.`);
            // Requerimiento explícito: devolver 404 si es desconocido
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const docData = snapshot.docs[0].data();
        const content = docData.knowledge_base;

        if (!content) {
            console.log(`[Consult FAQ] Agent '${agent_id}' found, but has no knowledge_base content.`);
            // Devolvemos info vacía o un mensaje por defecto, pero con success true porque el agente existe
            return NextResponse.json({
                success: true,
                info: "No hay información específica configurada para este agente."
            });
        }

        console.log(`[Consult FAQ] Serving content for '${agent_id}' (${content.length} chars)`);

        return NextResponse.json({
            success: true,
            info: content
        });

    } catch (error: any) {
        console.error("[Consult FAQ] Internal Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
