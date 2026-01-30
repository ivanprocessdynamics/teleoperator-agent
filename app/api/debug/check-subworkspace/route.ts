import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const subworkspaceId = searchParams.get("id");

        if (!subworkspaceId) {
            return NextResponse.json({ error: "Missing 'id' parameter" }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: "Admin SDK not initialized" }, { status: 500 });
        }

        const doc = await adminDb.collection("subworkspaces").doc(subworkspaceId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Subworkspace not found" }, { status: 404 });
        }

        const data = doc.data();

        return NextResponse.json({
            id: doc.id,
            analysis_config: data?.analysis_config || null,
            analysis_config_custom_fields_count: data?.analysis_config?.custom_fields?.length || 0,
            global_analysis_definitions: data?.global_analysis_definitions || null,
            global_analysis_definitions_count: data?.global_analysis_definitions?.length || 0,
            retell_agent_id: data?.retell_agent_id || null,
            name: data?.name || null,
            all_keys: Object.keys(data || {})
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
