import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        let body: any = {};
        try {
            body = await req.json();
        } catch (e) {
            console.log("[Search Proxy] Warning: Could not parse JSON body");
        }

        // Recuperamos el teléfono
        const phone = body.phone || req.headers.get('x-user-number');

        if (!phone) {
            console.error("[Search Proxy] Error: No phone number found in Body or Headers");
            return NextResponse.json({ error: "Phone number required" }, { status: 400 });
        }

        // --- EL CAMBIO CLAVE ---
        // En lugar de fabricar el string a mano, usamos la clase URL.
        // Ella sola se encarga de poner el %2B donde toca.
        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");
        satflowUrl.searchParams.set("phone", phone); // <--- Esto protege el '+' automáticamente

        console.log(`[Search Proxy] Input Phone: '${phone}'`);
        console.log(`[Search Proxy] Generated URL: ${satflowUrl.toString()}`);

        const authHeader = req.headers.get('authorization');

        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        if (!apiResponse.ok) {
            console.error(`[Search Proxy] SatFlow Error: ${apiResponse.status}`);
            return NextResponse.json({ found: false }, { status: apiResponse.status });
        }

        const data = await apiResponse.json();
        const customers = data.data || [];

        if (customers.length > 0) {
            const client = customers[0];
            const fullAddress = `${client.street || ''}, ${client.city || ''}`.replace(/^, |, $/g, '');

            console.log(`[Search Proxy] SUCCESS: Found client ${client.id}`);

            return NextResponse.json({
                found: true,
                id: client.id,
                name: client.fullName || client.name,
                address: fullAddress,
                city: client.city,
                email: client.email
            });
        } else {
            console.log(`[Search Proxy] Not Found. SatFlow returned empty list.`);
            return NextResponse.json({ found: false });
        }

    } catch (error: any) {
        console.error("[Search Proxy] Critical Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}