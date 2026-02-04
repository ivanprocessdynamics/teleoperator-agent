
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const input = searchParams.get('input');

    if (!input || input.length < 3) {
        return NextResponse.json({ predictions: [] });
    }

    try {
        // Restringimos a España (components=country:es) y lenguaje español
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&language=es&components=country:es`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
            return NextResponse.json({ predictions: data.predictions || [] });
        } else {
            console.error("[Places Proxy] Google Error:", data.status, data.error_message);
            return NextResponse.json({ error: "Google API Error", details: data.status }, { status: 500 });
        }

    } catch (error) {
        console.error("[Places Proxy] Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
