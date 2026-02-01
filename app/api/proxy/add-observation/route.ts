import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId, content, userName } = body;

        // 1. Validar que tenemos la ID para construir la URL
        if (!incidentId) {
            return NextResponse.json(
                { error: "Missing 'incidentId' parameter" },
                { status: 400 }
            );
        }

        // 2. Construir la URL dinámica hacia SatFlow
        const targetUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents/${incidentId}/observations`;

        const authHeader = req.headers.get('authorization');

        console.log(`[Proxy] Adding observation to Incident ${incidentId}`);

        // 3. Hacer el POST a la API real
        const apiResponse = await fetch(targetUrl, {
            method: 'POST', // SatFlow espera POST para crear observaciones
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify({
                content,
                userName: userName || "Asistente de Voz" // Valor por defecto si la IA no lo envía
            })
        });

        // 4. Devolver la respuesta
        const contentType = apiResponse.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await apiResponse.json();
        } else {
            const text = await apiResponse.text();
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }

        return NextResponse.json(data, { status: apiResponse.status });

    } catch (error: any) {
        console.error("[Proxy] Error:", error);
        return NextResponse.json(
            { error: "Internal Proxy Error", details: error.message },
            { status: 500 }
        );
    }
}