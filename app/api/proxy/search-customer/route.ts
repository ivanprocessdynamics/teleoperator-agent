import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        // 1. Leemos el Body RAW para depurar
        const rawBody = await req.text();
        console.log(`[Search Proxy] RAW Body received: '${rawBody}'`);

        let body: any = {};
        if (rawBody) {
            try {
                body = JSON.parse(rawBody);
            } catch (e) {
                console.log("[Search Proxy] JSON parsing failed");
            }
        }

        // 2. Solo aceptamos Body o Headers. IGNORAMOS la URL intencionadamente.
        const phone = body.phone || body.args?.phone || req.headers.get('x-user-number');

        console.log(`[Search Proxy] Teléfono recibido (INPUT): '${phone}'`);

        if (!phone) {
            return NextResponse.json({ error: "Phone required (Send in JSON body)" }, { status: 400 });
        }

        // 3. Construimos la URL hacia SatFlow de forma segura
        // La clase URL se encarga de convertir el '+' en '%2B' automáticamente.
        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");
        satflowUrl.searchParams.set("phone", phone);

        console.log(`[Search Proxy] URL Generada: ${satflowUrl.toString()}`);

        const authHeader = req.headers.get('authorization');

        // 4. Llamada a SatFlow
        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        if (!apiResponse.ok) {
            return NextResponse.json({ found: false }, { status: apiResponse.status });
        }

        const data = await apiResponse.json();
        const customers = data.data || [];

        if (customers.length > 0) {
            const client = customers[0];
            const fullAddress = `${client.street || ''}, ${client.city || ''}`.replace(/^, |, $/g, '');

            return NextResponse.json({
                found: true,
                id: client.id,
                name: client.fullName || client.name,
                address: fullAddress,
                city: client.city,
                email: client.email
            });
        } else {
            return NextResponse.json({ found: false });
        }

    } catch (error: any) {
        console.error("[Search Proxy] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}