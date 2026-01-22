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

        // 3. Retrieve LLM to check structure
        const currentLlm = await retell.llm.retrieve(llmId);
        console.log(`Current LLM State:`, JSON.stringify(currentLlm, null, 2));

        // 4. Update the LLM with the new prompt
        console.log(`Updating LLM ${llmId} with new prompt...`);

        // We try updating 'general_prompt'. 
        // Note: Check if 'system_prompt' exists in currentLlm and update that too if needed?
        // Retell V2 usually uses general_prompt.

        const llmUpdate = await retell.llm.update(llmId, {
            general_prompt: prompt
        });

        // 5. Verify update
        const updatedLlm = await retell.llm.retrieve(llmId);

        return NextResponse.json({
            success: true,
            message: "Prompt updated",
            llm_id: llmId,
            agent_id: agent_id,
            previous_prompt: currentLlm.general_prompt,
            new_prompt: updatedLlm.general_prompt,
            llm_type: currentLlm.model // log model type (e.g. gpt-4o)
        });

    } catch (error: any) {
        console.error("Error updating Retell agent:", error);
        return NextResponse.json({
            error: error.message || "Failed to update Agent",
            stack: error.stack
        }, { status: 500 });
    }
}
