import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
    try {
        const { phone_number, inbound_agent_id } = await req.json();

        if (!process.env.RETELL_API_KEY) {
            return NextResponse.json(
                { error: "RETELL_API_KEY not set" },
                { status: 500 }
            );
        }

        if (!phone_number) {
            return NextResponse.json(
                { error: "Phone number is required" },
                { status: 400 }
            );
        }

        // Update the phone number with the new inbound agent ID (or null to disconnect)
        // Note: The Retell SDK uses `update` method.
        // We ensure inbound_agent_id is passed, even if null (to disconnect/unset).
        const updatedPhoneNumber = await retell.phoneNumber.update(phone_number, {
            inbound_agent_id: inbound_agent_id || null
        });

        return NextResponse.json(updatedPhoneNumber, { status: 200 });
    } catch (error) {
        console.error("Error updating phone number:", error);
        return NextResponse.json(
            { error: "Failed to update phone number" },
            { status: 500 }
        );
    }
}
