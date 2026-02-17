
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
        console.log("[Consult FAQ] Full Body:", JSON.stringify(body, null, 2));

        // Support extraction from different locations (Direct, Retell wrapped, etc)
        // User requested to use 'retell_agent_id' as the function parameter
        let { retell_agent_id, agent_id, KB_id } = body;

        // Handle "Args Only = OFF" structure which might wrap args in .args or .arguments
        if (!retell_agent_id && !agent_id && !KB_id) {
            if (body.args) {
                retell_agent_id = body.args.retell_agent_id;
                agent_id = body.args.agent_id;
                KB_id = body.args.KB_id;
            } else if (body.arguments) {
                retell_agent_id = body.arguments.retell_agent_id;
                agent_id = body.arguments.agent_id;
                KB_id = body.arguments.KB_id;
            }
        }

        // Prioritize retell_agent_id as requested, fallbacks for backward compat
        const searchId = retell_agent_id || agent_id || KB_id;

        console.log(`[Consult FAQ] Extracted ID -> Final Search Term: ${searchId}`);

        if (!searchId) {
            console.warn("[Consult FAQ] Missing retell_agent_id in request body");
            return NextResponse.json({ error: "Missing retell_agent_id" }, { status: 400 });
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
