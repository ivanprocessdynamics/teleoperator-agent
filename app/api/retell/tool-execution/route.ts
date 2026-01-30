
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
    const startTime = Date.now();
    try {
        const body = await req.json();
        console.log("=== TOOL EXECUTION REQUEST ===");
        // console.log("Body:", JSON.stringify(body, null, 2));

        const { agent_id, args, name, call_id } = body;

        if (!agent_id || !name) {
            return NextResponse.json({ error: "Missing required fields (agent_id, name)" }, { status: 400 });
        }

        console.log(`Executing tool: ${name} for agent: ${agent_id}`);

        // 1. Find the tool config
        // Problem: We need to know WHICH subworkspace or campaign this agent belongs to.
        // Retell sends 'retell_agent_id' (which is mapped to our agent).
        // Strategies:
        // A. Search all subworkspaces/campaigns (Costly)
        // B. Use metadata if Retell sends it (Retell sends metadata if in call)
        // However, this is a Function Call during a call. Retell sends the call object?
        // Payload for function call usually includes call_id. We can fetch call details or rely on args.

        // OPTIMIZATION: We can't easily find the tool definition without querying.
        // Let's assume we can search by Agent ID in 'campaigns' and 'subworkspaces' if we have an index, 
        // OR we can query 'agents' collection if we had one.

        // fallback: Search in cached/known locations or rely on naming convention? NO.

        // Let's try to find by agent_id.
        // Note: In our system, agent_id is stored in 'campaigns' (retell_agent_id) or 'subworkspaces' (inbound_agent_id).

        let toolConfig = null;
        let contextId = null; // campaignId or subworkspaceId
        let contextType = null; // 'campaign' or 'subworkspace'

        // Search in campaigns
        const campaignsSnapshot = await adminDb.collection('campaigns').where('retell_agent_id', '==', agent_id).limit(1).get();
        if (!campaignsSnapshot.empty) {
            const campDoc = campaignsSnapshot.docs[0];
            const campData = campDoc.data();
            toolConfig = campData.tools?.find((t: any) => t.name === name); // Match by name (sanitized)
            // Handle case where name might be different due to sanitization?
            // We sanitized ON SAVE. So DB has sanitized name. 
            // Retell sends the sanitized name. So direct match is correct.
            contextId = campDoc.id;
            contextType = 'campaign';
        }

        // Search in subworkspaces (Inbound)
        if (!toolConfig) {
            const subSnapshot = await adminDb.collection('subworkspaces').where('inbound_agent_id', '==', agent_id).limit(1).get();
            if (!subSnapshot.empty) {
                const subDoc = subSnapshot.docs[0];
                const subData = subDoc.data();
                toolConfig = subData.tools?.find((t: any) => t.name === name);
                contextId = subDoc.id;
                contextType = 'subworkspace';
            }
        }

        if (!toolConfig) {
            console.error(`Tool definition not found for ${name} on agent ${agent_id}`);
            return NextResponse.json({
                error: `Tool definition not found for function: ${name}`
            }, { status: 404 });
        }

        // 2. Prepare Request
        // 2. Prepare Request
        let url = toolConfig.url;
        const method = toolConfig.method || 'GET';
        let headers: Record<string, string> = {};
        if (toolConfig.headers) {
            toolConfig.headers.forEach((h: any) => {
                headers[h.key] = h.value;
            });
        }

        // Replace URL params if any (e.g. /users/{id}) -> Not currently supported in UI editor but good for future.
        // For now, we assume Query Params for GET and Body for POST.

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

        // 3. Execute Request
        console.log(`Calling External API: ${method} ${finalUrl}`);
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
            console.error("External API Fetch Failed:", err);
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
                call_id: call_id || null, // Link to call if available
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                request: {
                    url: finalUrl,
                    method,
                    headers: toolConfig.headers || [], // Don't log secrets if possible? For now log all.
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

        // 5. Return Response to Retell
        // Retell expects a specific JSON structure for the result.
        // Or actually, Retell just wants the result as a string or json object.
        console.log(`Tool Result: Success=${success}`);

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("Tool Execution Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
