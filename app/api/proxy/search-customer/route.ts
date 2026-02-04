import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        let body: any = {};
        try {
            const rawBody = await req.text();
            if (rawBody) body = JSON.parse(rawBody);
        } catch (e) {
            console.log("[Search Proxy] Body vacío o inválido");
        }

        // VARIABLES DE BÚSQUEDA
        const bodyPhone = body.phone;
        const bodyName = body.name; // <--- Nuevo campo
        const headerPhone = req.headers.get('x-user-number');

        console.log(`[Search Proxy] Inputs -> Name: '${bodyName}', BodyPhone: '${bodyPhone}', HeaderPhone: '${headerPhone}'`);

        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");

        // LÓGICA DE PRIORIDAD:
        // 1. Si la IA nos manda un NOMBRE, buscamos por nombre (prioridad manual).
        // 2. Si la IA nos manda un TELÉFONO, buscamos por ese teléfono (prioridad manual).
        // 3. Si la IA no manda nada, usamos el TELÉFONO DEL LLAMANTE (automático).

        if (bodyName) {
            satflowUrl.searchParams.set("name", bodyName);
        } else if (bodyPhone) {
            satflowUrl.searchParams.set("phone", bodyPhone);
        } else if (headerPhone) {
            satflowUrl.searchParams.set("phone", headerPhone);
        } else {
            return NextResponse.json({ error: "No search criteria provided" }, { status: 400 });
        }

        console.log(`[Search Proxy] URL Generada: ${satflowUrl.toString()}`);

        const authHeader = req.headers.get('authorization');
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
            const client = customers[0]; // Cogemos el primero que coincida
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