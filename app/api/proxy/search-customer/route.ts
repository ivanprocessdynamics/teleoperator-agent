import { NextRequest, NextResponse } from 'next/server';

// Recibimos POST desde Retell para evitar problemas de URL encoding
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone } = body;

        if (!phone) {
            return NextResponse.json({ error: "Phone number required" }, { status: 400 });
        }

        // 🛡️ EL SECRETO: Esto convierte el "+" en "%2B" automáticamente
        const encodedPhone = encodeURIComponent(phone);

        // Construimos la URL real para SatFlow (que es GET)
        const targetUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search?phone=${encodedPhone}`;

        const authHeader = req.headers.get('authorization');

        console.log(`[Search Proxy] Buscando: ${phone} -> Enviando a API: ${encodedPhone}`);

        // Hacemos la llamada real
        const apiResponse = await fetch(targetUrl, {
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

        // Simplificamos la respuesta para la IA
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