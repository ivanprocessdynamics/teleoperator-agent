import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

interface ToolExecutionRequest {
    agent_id: string;
    name: string;
    args: any;
    call_id?: string;
    from_number?: string | null;
}

export async function executeToolCall(request: ToolExecutionRequest) {
    const { agent_id, name, args, call_id, from_number } = request;
    const startTime = Date.now();

    console.log(`[Tool Service] Executing tool: ${name} for agent: ${agent_id}`);

    // Helper to match sanitized names
    const sanitize = (str: string) => str.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
    const targetName = sanitize(name);

    // 1. Find the tool config
    let toolConfig = null;
    let contextId = null; // campaignId or subworkspaceId
    let contextType = null; // 'campaign' or 'subworkspace'

    if (!adminDb) {
        console.error("[Tool Service] adminDb not initialized. Cannot execute tool.");
        return { error: "Database not available", status: 500 };
    }

    // Search in campaigns
    const campaignsSnapshot = await adminDb.collection('campaigns').where('retell_agent_id', '==', agent_id).limit(1).get();
    if (!campaignsSnapshot.empty) {
        const campDoc = campaignsSnapshot.docs[0];
        const campData = campDoc.data();
        // Match using sanitized name
        toolConfig = campData.tools?.find((t: any) => sanitize(t.name) === targetName);
        contextId = campDoc.id;
        contextType = 'campaign';
    }

    // Search in subworkspaces (Inbound)
    if (!toolConfig) {
        const subSnapshot = await adminDb.collection('subworkspaces').where('retell_agent_id', '==', agent_id).limit(1).get();
        if (!subSnapshot.empty) {
            const subDoc = subSnapshot.docs[0];
            const subData = subDoc.data();
            toolConfig = subData.tools?.find((t: any) => sanitize(t.name) === targetName);
            contextId = subDoc.id;
            contextType = 'subworkspace';
        } else {
            // Fallback: Check inbound_agent_id (legacy field name?)
            const subSnapshot2 = await adminDb.collection('subworkspaces').where('inbound_agent_id', '==', agent_id).limit(1).get();
            if (!subSnapshot2.empty) {
                const subDoc = subSnapshot2.docs[0];
                const subData = subDoc.data();
                toolConfig = subData.tools?.find((t: any) => sanitize(t.name) === targetName);
                contextId = subDoc.id;
                contextType = 'subworkspace';
            }
        }
    }

    if (!toolConfig) {
        console.error(`[Tool Service] Tool definition not found for ${name} on agent ${agent_id}`);
        return {
            error: `Tool definition not found for function: ${name}`
        };
    }

    // 2. Prepare Request
    let url = toolConfig.url;
    const method = toolConfig.method || 'GET';
    let headers: Record<string, string> = {};
    if (toolConfig.headers) {
        toolConfig.headers.forEach((h: any) => {
            headers[h.key] = h.value;
        });
    }

    let bodyPayload = null;
    let finalUrl = url;

    if (method === 'GET') {
        const urlObj = new URL(url);
        Object.keys(args).forEach(key => {
            urlObj.searchParams.append(key, args[key]);
        });
        finalUrl = urlObj.toString();
    } else {
        bodyPayload = JSON.stringify(args);
        headers['Content-Type'] = 'application/json';
    }

    // Inject caller phone as x-user-number header (used by search-customer, create-incident)
    if (from_number) {
        headers['x-user-number'] = from_number;
        console.log(`[Tool Service] Injecting x-user-number: ${from_number}`);
    }

    // 3. Execute Request
    console.log(`[Tool Service] Calling External API: ${method} ${finalUrl}`);
    let responseData;
    let status;
    let success = false;
    let errorMsg = null;

    try {
        const res = await fetch(finalUrl, {
            method,
            headers,
            body: bodyPayload
        });
        status = res.status;

        const text = await res.text();
        try {
            responseData = JSON.parse(text);
        } catch (e) {
            responseData = text;
        }

        if (res.ok) {
            success = true;
        } else {
            errorMsg = `API Error: ${status} ${JSON.stringify(responseData)}`;
        }

    } catch (err: any) {
        status = 500;
        errorMsg = err.message;
        responseData = { error: err.message };
        console.error("[Tool Service] External API Fetch Failed:", err);
    }

    const duration = Date.now() - startTime;

    // 4. Log to Firestore
    if (contextId && contextType) {
        const logCollection = contextType === 'campaign'
            ? adminDb.collection('campaigns').doc(contextId).collection('tool_logs')
            : adminDb.collection('subworkspaces').doc(contextId).collection('tool_logs');

        const logEntry = {
            tool_id: toolConfig.id,
            tool_name: toolConfig.name,
            call_id: call_id || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            request: {
                url: finalUrl,
                method,
                headers: toolConfig.headers || [],
                body: args
            },
            response: {
                status,
                data: responseData,
                error: errorMsg
            },
            duration_ms: duration,
            success
        };

        // Non-blocking write
        logCollection.add(logEntry).catch(e => console.error("Failed to write tool log:", e));
    }

    console.log(`[Tool Service] Tool Result: Success=${success}`);
    return responseData;
}
