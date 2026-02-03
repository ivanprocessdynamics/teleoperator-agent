
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';

export async function POST(req: NextRequest) {
    try {
        const { incidentId, address } = await req.json();

        if (!incidentId || !address) {
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
        }

        // 1. Validamos la nueva dirección con Google Maps
        const valResult = await validateAddress(address);
        const cleanAddress = valResult.address;

        // 2. Enviamos a SatFlow
        // Usamos la misma lógica que en update-incident: PATCH a /incidents/:id
        const satflowUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents/${incidentId}`;

        // NOTA: Esta API Key debe estar en tus variables de entorno (.env.local) en Vercel.
        // Si no la tienes, esto fallará (o SatFlow devolverá 401/403).
        const apiKey = process.env.SATFLOW_API_KEY;

        const response = await fetch(satflowUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                // Si SatFlow usa Bearer Token:
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
            },
            body: JSON.stringify({
                location: cleanAddress, // SatFlow usa 'location'
                description: `\n\nACTUALIZACIÓN WEB (Cliente): Dirección corregida a: ${cleanAddress}` // Optional log in description
            })
        });

        if (!response.ok) {
            console.error(`[Web Update] SatFlow Error: ${response.status}`);
            return NextResponse.json({ error: "Fallo en SatFlow" }, { status: response.status });
        }

        return NextResponse.json({ success: true, newAddress: cleanAddress });

    } catch (error) {
        console.error("Error web update:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
