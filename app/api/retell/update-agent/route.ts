import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
    try {
        if (!process.env.RETELL_API_KEY) {
            return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 });
        }

        const body = await req.json();
        const { agent_id, prompt, analysis_config } = body;

        console.log("=== UPDATE AGENT REQUEST ===");
        console.log("Agent ID:", agent_id);
        console.log("Prompt provided:", prompt ? `"${prompt.substring(0, 100)}..."` : "NO");
        console.log("Analysis config:", analysis_config ? "YES" : "NO");

        if (!agent_id) {
            return NextResponse.json({ error: "Missing agent_id" }, { status: 400 });
        }

        const updates: any = {};

        // 1. Handle Prompt Update (Push to LLM)
        if (prompt) {
            console.log("Retrieving agent to find LLM ID...");
            let agent;
            try {
                agent = await retell.agent.retrieve(agent_id);
            } catch (err: any) {
                console.error("Failed to retrieve agent:", err);
                throw new Error(`Agent retrieval failed: ${err.message}`);
            }

            console.log("Agent response_engine:", JSON.stringify(agent.response_engine));

            if (agent.response_engine?.type === 'retell-llm' && agent.response_engine.llm_id) {
                const llmId = agent.response_engine.llm_id;
                console.log("Found LLM ID:", llmId);
                console.log("Updating LLM with new prompt...");

                try {
                    // CRITICAL FIX: Use the actual prompt provided by the client.
                    // This allows Inbound Agents to have their specific instructions.
                    // If dynamic behavior is needed, the client should send "{{campaign_prompt}}" as the prompt string.
                    const llmUpdateResult = await retell.llm.update(llmId, {
                        general_prompt: prompt
                    });
                    console.log("LLM update successful (configured for dynamic prompt):", llmUpdateResult.llm_id);
                    updates.prompt_updated = true;
                    updates.llm_id = llmId;
                } catch (llmError: any) {
                    console.error("LLM update FAILED:", llmError);
                    updates.prompt_error = `LLM Update Error: ${llmError.message}`;
                    // Don't throw entire request, just mark failure
                }
            } else {
                console.warn("Agent does not use Retell LLM or LLM ID not found");
                console.warn("Response engine type:", agent.response_engine?.type);
                updates.prompt_error = "Agent does not use Retell LLM";
            }
        }

        // 2. Handle Analysis Config Update
        if (analysis_config) {
            try {
                const customData = [];

                if (analysis_config.standard_fields?.satisfaction_score) {
                    customData.push({
                        name: "satisfaction_score",
                        description: "Rate the customer's satisfaction on a scale from 0 to 10 based on their tone and responses.",
                        type: "number" as const
                    });
                }

                if (analysis_config.standard_fields?.call_successful) {
                    customData.push({
                        name: "call_successful",
                        description: "Did the AI agent successfully achieve the primary goal of the call?",
                        type: "boolean" as const
                    });
                }

                if (analysis_config.standard_fields?.user_sentiment) {
                    customData.push({
                        name: "user_sentiment_label",
                        description: "Determine the user's overall sentiment: Positive, Negative, Neutral, or Angry.",
                        type: "string" as const
                    });
                }

                if (analysis_config.standard_fields?.summary) {
                    customData.push({
                        name: "resumen_espanol",
                        description: "Resumen detallado de la llamada en español.",
                        type: "string" as const
                    });
                }

                if (analysis_config.custom_fields) {
                    for (const field of analysis_config.custom_fields) {
                        customData.push({
                            name: field.name,
                            description: field.description,
                            type: field.type
                        });
                    }
                }

                console.log("Updating agent analysis config...");
                await retell.agent.update(agent_id, {
                    post_call_analysis_data: {
                        post_call_summary: analysis_config.standard_fields?.summary || false,
                        post_call_sentiment: analysis_config.standard_fields?.sentiment || false,
                        custom_analysis_data: customData
                    } as any
                });
                updates.analysis_updated = true;
            } catch (analysisErr: any) {
                console.error("Analysis update FAILED:", analysisErr);
                updates.analysis_error = `Analysis Error: ${analysisErr.message}`;
            }
        }

        console.log("=== UPDATE COMPLETE ===", updates);

        return NextResponse.json({
            success: true,
            message: "Agent updated successfully",
            updates: updates
        });

    } catch (error: any) {
        console.error("Critical Error updating Retell agent:", error);
        return NextResponse.json({
            error: error.message || "Failed to update Agent",
            stack: error.stack,
            details: JSON.stringify(error)
        }, { status: 500 });
    }
}
