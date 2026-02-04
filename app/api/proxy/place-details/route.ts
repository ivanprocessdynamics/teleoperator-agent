
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('place_id');

    if (!placeId) {
        return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
    }

    try {
        // Pedimos solo los campos de address_components para ahorrar (aunque Details suele tener precio fijo)
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components&key=${apiKey}&language=es`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK') {
            return NextResponse.json({ result: data.result });
        } else {
            console.error("[Place Details Proxy] Google Error:", data.status);
            return NextResponse.json({ error: "Google API Error", details: data.status }, { status: 500 });
        }

    } catch (error) {
        console.error("[Place Details Proxy] Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
