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

        if (!agent_id) {
            return NextResponse.json({ error: "Missing agent_id" }, { status: 400 });
        }

        const updates: any = {};

        // 1. Handle Prompt Update (Push)
        // Note: We are moving to Dynamic Variables, but we keep this for backward compat 
        // or if the user explicitly wants to "Reset" the hardcoded prompt.
        if (prompt) {
            // Find LLM and update
            const agent = await retell.agent.retrieve(agent_id);
            if (agent.response_engine?.type === 'retell-llm' && agent.response_engine.llm_id) {
                const llmId = agent.response_engine.llm_id;
                await retell.llm.update(llmId, { general_prompt: prompt });
                updates.prompt_updated = true;
            }
        }

        // 2. Handle Analysis Config Update
        if (analysis_config) {
            const customData = [];

            // Map Standard Fields to Custom Data (unless native)
            // 'summary' and 'sentiment' are native fields in post_call_analysis_data

            if (analysis_config.standard_fields.satisfaction_score) {
                customData.push({
                    name: "satisfaction_score",
                    description: "Rate the customer's satisfaction on a scale from 0 to 10 based on their tone and responses.",
                    type: "number" as const
                });
            }

            if (analysis_config.standard_fields.call_successful) {
                customData.push({
                    name: "call_successful",
                    description: "Did the AI agent successfully achieve the primary goal of the call?",
                    type: "boolean" as const
                });
            }

            if (analysis_config.standard_fields.user_sentiment) {
                customData.push({
                    name: "user_sentiment_label",
                    description: "Determine the user's overall sentiment: Positive, Negative, Neutral, or Angry.",
                    type: "string" as const
                });
            }

            // Always add Spanish Summary
            customData.push({
                name: "resumen_espanol",
                description: "Resumen detallado de la llamada en español.",
                type: "string" as const
            });

            // Map User's Custom Fields
            if (analysis_config.custom_fields) {
                for (const field of analysis_config.custom_fields) {
                    customData.push({
                        name: field.name,
                        description: field.description,
                        type: field.type // Retell uses 'string' | 'boolean' | 'number' | 'enum'
                    });
                }
            }

            // Update Agent
            await retell.agent.update(agent_id, {
                post_call_analysis_data: {
                    post_call_summary: analysis_config.standard_fields.summary || false,
                    post_call_sentiment: analysis_config.standard_fields.sentiment || false,
                    custom_analysis_data: customData
                } as any
            });
            updates.analysis_updated = true;
        }

        return NextResponse.json({
            success: true,
            message: "Agent updated successfully",
            updates: updates
        });

    } catch (error: any) {
        console.error("Error updating Retell agent:", error);
        return NextResponse.json({
            error: error.message || "Failed to update Agent",
            stack: error.stack
        }, { status: 500 });
    }
}
