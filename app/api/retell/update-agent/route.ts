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
        const { agent_id, prompt } = body;

        if (!agent_id || !prompt) {
            return NextResponse.json({ error: "Missing agent_id or prompt" }, { status: 400 });
        }

        // 1. Fetch Agent to find its LLM
        console.log(`Fetching agent ${agent_id}...`);
        const agent = await retell.agent.retrieve(agent_id);

        if (!agent.response_engine) {
            return NextResponse.json({ error: "Agent has no response_engine configured" }, { status: 400 });
        }

        // 2. Identify LLM ID
        // Note: Retell agents usually have response_engine: { type: 'retell-llm', llm_id: '...' }
        // If it's a 'custom-llm', we can't update the prompt here (it's managed by your server).
        if (agent.response_engine.type !== "retell-llm") {
            return NextResponse.json({
                error: `Cannot update prompt for agent type '${agent.response_engine.type}'. Only 'retell-llm' is supported.`
            }, { status: 400 });
        }

        const llmId = agent.response_engine.llm_id;
        if (!llmId) {
            return NextResponse.json({ error: "Agent has no LLM ID assigned" }, { status: 400 });
        }

        // 3. Update the LLM with the new prompt
        console.log(`Updating LLM ${llmId} with new prompt...`);
        // Using 'general_prompt' as the likely field for system prompt in Retell LLM
        // If Retell API changed, this might need adjustment to 'system_prompt' or 'general_system_prompt'
        // Checking Retell types usually reveals 'general_prompt' or 'model_config'.
        // Based on recent docs: 'general_prompt' is the unified system prompt.
        const llmUpdate = await retell.llm.update(llmId, {
            general_prompt: prompt
        });

        return NextResponse.json({
            success: true,
            message: "Prompt updated",
            llm_id: llmId,
            agent_id: agent_id
        });

    } catch (error: any) {
        console.error("Error updating Retell agent:", error);
        return NextResponse.json({
            error: error.message || "Failed to update Agent",
            stack: error.stack
        }, { status: 500 });
    }
}
