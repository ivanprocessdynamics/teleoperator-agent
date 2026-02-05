
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
        const { KB_id, agent_id } = body;
        const searchId = KB_id || agent_id;

        console.log(`[Consult FAQ] Received request. KB_id: ${KB_id}, agent_id: ${agent_id} -> Searching for: ${searchId}`);

        if (!searchId) {
            console.warn("[Consult FAQ] Missing KB_id (or agent_id) in request body");
            return NextResponse.json({ error: "Missing KB_id" }, { status: 400 });
        }

        let docData: any = null;

        // 1. Intentar buscar por campo 'retell_agent_id'
        let snapshot = await adminDb.collection('subworkspaces')
            .where('retell_agent_id', '==', searchId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            docData = snapshot.docs[0].data();
            console.log(`[Consult FAQ] Found by retell_agent_id: ${searchId}`);
        } else {
            // 2. Fallback: Intentar buscar por ID de documento
            console.log(`[Consult FAQ] Not found by retell_agent_id. Trying Document ID lookup for: ${searchId}`);
            const docRef = await adminDb.collection('subworkspaces').doc(searchId).get();

            if (docRef.exists) {
                docData = docRef.data();
                console.log(`[Consult FAQ] Found by Document ID: ${searchId}`);
            }
        }

        if (!docData) {
            // 3. Fallback: Intentar buscar por campo 'slug'
            console.log(`[Consult FAQ] Trying 'slug' lookup for: ${searchId}`);
            const slugSnapshot = await adminDb.collection('subworkspaces')
                .where('slug', '==', searchId)
                .limit(1)
                .get();

            if (!slugSnapshot.empty) {
                docData = slugSnapshot.docs[0].data();
                console.log(`[Consult FAQ] Found by slug.`);
            }
        }

        if (!docData) {
            // 4. Fallback: Intentar buscar por campo 'name'
            console.log(`[Consult FAQ] Trying 'name' lookup for: ${searchId}`);
            const nameSnapshot = await adminDb.collection('subworkspaces')
                .where('name', '==', searchId)
                .limit(1)
                .get();

            if (!nameSnapshot.empty) {
                docData = nameSnapshot.docs[0].data();
                console.log(`[Consult FAQ] Found by name.`);
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

// MÉTODO DE DEBUG TEMPORAL: Listar todos los agentes disponibles
export async function GET() {
    try {
        if (!adminDb) return NextResponse.json({ error: "No DB" }, { status: 500 });

        const snapshot = await adminDb.collection('subworkspaces').get();
        const agents = snapshot.docs.map(doc => ({
            id: doc.id,
            retell_agent_id: doc.data().retell_agent_id,
            name: doc.data().name,
            kb_length: doc.data().knowledge_base?.length || 0
        }));

        return NextResponse.json({
            count: agents.length,
            agents: agents
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
