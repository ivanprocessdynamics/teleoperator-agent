
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
        const { KB_id, agent_id } = body; // Aceptamos KB_id como principal, fallback a agent_id
        const searchId = KB_id || agent_id;

        console.log(`[Consult FAQ] Received request. KB_id: ${KB_id}, agent_id: ${agent_id} -> Searching for: ${searchId}`);

        if (!searchId) {
            console.warn("[Consult FAQ] Missing KB_id (or agent_id) in request body");
            return NextResponse.json({ error: "Missing KB_id" }, { status: 400 });
        }

        // 1. Intentar buscar por campo 'retell_agent_id'
        let snapshot = await adminDb.collection('subworkspaces')
            .where('retell_agent_id', '==', searchId)
            .limit(1)
            .get();

        let docData: any = null;

        if (!snapshot.empty) {
            docData = snapshot.docs[0].data();
            console.log(`[Consult FAQ] Found by retell_agent_id: ${searchId}`);
        } else {
            // 2. Fallback: Intentar buscar por ID de documento
            console.log(`[Consult FAQ] Not found by retell_agent_id. Trying Document ID lookup for: ${searchId}`);
            // NOTA: Si 'satflow' es un slug o un ID custom en otro campo, habría que buscar por ese campo. 
            // Asumimos que si no es retell_agent_id, podría ser el ID del documento.
            const docRef = await adminDb.collection('subworkspaces').doc(searchId).get();

            if (docRef.exists) {
                docData = docRef.data();
                console.log(`[Consult FAQ] Found by Document ID: ${searchId}`);
            }
        }

        if (!docData) {
            console.warn(`[Consult FAQ] ID '${searchId}' not found in subworkspaces.`);
            return NextResponse.json({ error: "ID not found" }, { status: 404 });
        }

        const content = docData.knowledge_base;

        if (!content) {
            console.log(`[Consult FAQ] Agent/Workspace found, but has no knowledge_base content.`);
            return NextResponse.json({
                success: true,
                info: "No hay información adicional configurada."
            });
        }

        console.log(`[Consult FAQ] Serving content (${content.length} chars)`);

        return NextResponse.json({
            success: true,
            info: content
        });

    } catch (error: any) {
        console.error("[Consult FAQ] Internal Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
