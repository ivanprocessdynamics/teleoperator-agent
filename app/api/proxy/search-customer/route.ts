import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone } = body;

        // 1. Validación
        if (!phone) {
            return NextResponse.json({ error: "Phone number required" }, { status: 400 });
        }

        // 2. SOLUCIÓN DEL ERROR DEL '+':
        // encodeURIComponent convierte '+34...' en '%2B34...'
        // Así SatFlow entenderá el símbolo correctamente.
        const encodedPhone = encodeURIComponent(phone);

        const targetUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search?phone=${encodedPhone}`;
        const authHeader = req.headers.get('authorization');

        console.log(`[Search Proxy] Buscando: ${phone} -> URL: ${targetUrl}`);

        // 3. Petición a SatFlow
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

        // 4. Respuesta simplificada para la IA
        if (customers.length > 0) {
            const client = customers[0];
            // Combinamos dirección para facilitar la creación del ticket luego
            const fullAddress = `${client.street || ''}, ${client.city || ''}`.replace(/^, |, $/g, '');

            return NextResponse.json({
                found: true,
                id: client.id,
                name: client.fullName || client.name,
                address: fullAddress, // Dirección completa lista para usar
                city: client.city
            });
        } else {
            return NextResponse.json({
                found: false
            });
        }

    } catch (error: any) {
        console.error("[Search Proxy] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}