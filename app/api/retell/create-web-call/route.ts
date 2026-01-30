import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
    try {
        const { agent_id, prompt, subworkspace_id } = await req.json();

        if (!process.env.RETELL_API_KEY) {
            return NextResponse.json(
                { error: "RETELL_API_KEY not set" },
                { status: 500 }
            );
        }

        // Create a Web Call to get the access token
        const webCallResponse = await retell.call.createWebCall({
            agent_id: agent_id,
            retell_llm_dynamic_variables: {
                campaign_prompt: prompt || "Prompt no configurado",
            },
            metadata: {
                type: 'testing',
                agent_id: agent_id,
                subworkspace_id: subworkspace_id || null // For webhook to load custom field config
            }
        });

        return NextResponse.json(webCallResponse, { status: 200 });
    } catch (error) {
        console.error("Error creating web call:", error);
        return NextResponse.json(
            { error: "Failed to create web call" },
            { status: 500 }
        );
    }
}
