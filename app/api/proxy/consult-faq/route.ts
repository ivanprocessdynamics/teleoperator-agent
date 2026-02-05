
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

        // 1. Intentar buscar por campo 'retell_agent_id' (para ID de Retell auténtico)
        let snapshot = await adminDb.collection('subworkspaces')
            .where('retell_agent_id', '==', agent_id)
            .limit(1)
            .get();

        let docData: any = null;

        if (!snapshot.empty) {
            docData = snapshot.docs[0].data();
            console.log(`[Consult FAQ] Found by retell_agent_id.`);
        } else {
            // 2. Fallback: Intentar buscar por ID de documento (por si están usando ID interno o custom como 'satflow')
            console.log(`[Consult FAQ] Not found by retell_agent_id. Trying Document ID lookup for: ${agent_id}`);
            const docRef = await adminDb.collection('subworkspaces').doc(agent_id).get();

            if (docRef.exists) {
                docData = docRef.data();
                console.log(`[Consult FAQ] Found by valid Document ID.`);
            }
        }

        if (!docData) {
            console.warn(`[Consult FAQ] Agent ID '${agent_id}' not found in subworkspaces (neither as field nor ID).`);
            // Requerimiento explícito: devolver 404 si es desconocido
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const content = docData.knowledge_base;

        if (!content) {
            console.log(`[Consult FAQ] Agent '${agent_id}' found, but has no knowledge_base content.`);
            // Devolvemos info vacía o un mensaje por defecto, pero con success true porque el agente existe
            return NextResponse.json({
                success: true,
                info: "No hay información adicional configurada para este agente."
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
