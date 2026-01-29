import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
    apiKey: process.env.RETELL_API_KEY || "",
});

export async function GET() {
    try {
        if (!process.env.RETELL_API_KEY) {
            return NextResponse.json(
                { error: "RETELL_API_KEY not set" },
                { status: 500 }
            );
        }

        const phoneNumbers = await retell.phoneNumber.list();

        return NextResponse.json(phoneNumbers, { status: 200 });
    } catch (error) {
        console.error("Error fetching phone numbers:", error);
        return NextResponse.json(
            { error: "Failed to fetch phone numbers" },
            { status: 500 }
        );
    }
}
