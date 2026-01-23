import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
    try {
        const {
            from_number,
            to_number,
            agent_id,
            dynamic_variables,
            metadata
        } = await req.json();

        if (!process.env.RETELL_API_KEY) {
            return NextResponse.json(
                { error: "RETELL_API_KEY not set" },
                { status: 500 }
            );
        }

        if (!from_number || !to_number) {
            return NextResponse.json(
                { error: "from_number and to_number are required" },
                { status: 400 }
            );
        }

        // Validate E.164 format
        const e164Regex = /^\+[1-9]\d{6,14}$/;
        if (!e164Regex.test(to_number)) {
            return NextResponse.json(
                { error: "to_number must be in E.164 format (e.g., +34612345678)" },
                { status: 400 }
            );
        }

        // Create outbound phone call
        const phoneCallResponse = await retell.call.createPhoneCall({
            from_number: from_number,
            to_number: to_number,
            override_agent_id: agent_id,
            retell_llm_dynamic_variables: dynamic_variables || {},
            metadata: metadata || {},
        });

        return NextResponse.json({
            call_id: phoneCallResponse.call_id,
            call_status: phoneCallResponse.call_status,
            agent_id: phoneCallResponse.agent_id,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Error creating phone call:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create phone call" },
            { status: 500 }
        );
    }
}
