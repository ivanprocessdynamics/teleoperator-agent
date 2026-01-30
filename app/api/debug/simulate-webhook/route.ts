import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Simulates exactly what the webhook does to find custom fields.
 * Call with: /api/debug/simulate-webhook?subworkspace_id=xxx&agent_id=yyy
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const subworkspaceId = searchParams.get("subworkspace_id");
    const agentId = searchParams.get("agent_id");

    const debugLog: string[] = [];
    let customFields: any[] = [];
    let configSource = "none";
    let resolvedSubworkspaceId: string | null = null;

    try {
        if (!adminDb) {
            return NextResponse.json({ error: "Admin SDK not initialized", debugLog }, { status: 500 });
        }

        debugLog.push(`Starting simulation with subworkspace_id=${subworkspaceId}, agent_id=${agentId}`);

        // PRIORITY 1: Use subworkspace_id from metadata
        if (subworkspaceId) {
            debugLog.push(`Attempting to load subworkspace: ${subworkspaceId}`);

            const subDoc = await adminDb.collection("subworkspaces").doc(subworkspaceId).get();

            if (subDoc.exists) {
                const subSettings = subDoc.data();
                debugLog.push(`Subworkspace found. Keys: ${Object.keys(subSettings || {}).join(", ")}`);
                debugLog.push(`analysis_config exists: ${!!subSettings?.analysis_config}`);
                debugLog.push(`analysis_config.custom_fields exists: ${!!subSettings?.analysis_config?.custom_fields}`);
                debugLog.push(`analysis_config.custom_fields length: ${subSettings?.analysis_config?.custom_fields?.length || 0}`);
                debugLog.push(`global_analysis_definitions exists: ${!!subSettings?.global_analysis_definitions}`);
                debugLog.push(`global_analysis_definitions length: ${subSettings?.global_analysis_definitions?.length || 0}`);

                // PRIORITY: Try analysis_config.custom_fields first
                customFields = subSettings?.analysis_config?.custom_fields || [];
                debugLog.push(`After reading analysis_config.custom_fields: ${customFields.length} fields`);

                // FALLBACK: If empty, use global_analysis_definitions
                if (customFields.length === 0 && subSettings?.global_analysis_definitions?.length > 0) {
                    debugLog.push(`Falling back to global_analysis_definitions`);
                    customFields = subSettings!.global_analysis_definitions.filter((f: any) => !f.isArchived);
                    debugLog.push(`After global_analysis_definitions filter: ${customFields.length} active fields`);
                }

                configSource = `subworkspace:${subworkspaceId}`;
                resolvedSubworkspaceId = subworkspaceId;
            } else {
                debugLog.push(`Subworkspace ${subworkspaceId} NOT FOUND`);
            }
        }

        // PRIORITY 2: Fallback to retell_agent_id query
        if (customFields.length === 0 && agentId) {
            debugLog.push(`No fields found yet, trying agent_id lookup: ${agentId}`);

            const snapshot = await adminDb.collection("subworkspaces").where("retell_agent_id", "==", agentId).get();

            if (!snapshot.empty) {
                const subSettings = snapshot.docs[0].data();
                debugLog.push(`Found subworkspace by agent_id. ID: ${snapshot.docs[0].id}`);

                customFields = subSettings?.analysis_config?.custom_fields || [];
                debugLog.push(`analysis_config.custom_fields: ${customFields.length} fields`);

                if (customFields.length === 0 && subSettings?.global_analysis_definitions?.length > 0) {
                    debugLog.push(`Falling back to global_analysis_definitions`);
                    customFields = subSettings.global_analysis_definitions.filter((f: any) => !f.isArchived);
                }

                configSource = `subworkspace:${snapshot.docs[0].id}`;
                resolvedSubworkspaceId = snapshot.docs[0].id;
            } else {
                debugLog.push(`No subworkspace found for agent_id: ${agentId}`);
            }
        }

        // Filter out archived fields
        const activeFields = customFields.filter((f: any) => !f.isArchived);
        debugLog.push(`Final active fields count: ${activeFields.length}`);

        return NextResponse.json({
            success: true,
            resolvedSubworkspaceId,
            configSource,
            customFieldsFound: customFields.length,
            activeFieldsCount: activeFields.length,
            fieldNames: activeFields.map((f: any) => f.name),
            debugLog
        });

    } catch (error: any) {
        debugLog.push(`ERROR: ${error.message}`);
        return NextResponse.json({
            error: error.message,
            debugLog
        }, { status: 500 });
    }
}
