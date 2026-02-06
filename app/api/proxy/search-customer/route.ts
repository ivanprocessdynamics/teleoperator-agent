
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

        console.log("[Search Proxy] Full Body / Headers Debug:", {
            headers: Object.fromEntries(req.headers),
            bodyKeys: Object.keys(body),
            // No logueamos todo el body por privacidad/ruido, pero sí claves
        });

        // ESTRATEGIA SUPRA-ROBUSTA DE EXTRACCIÓN DE TELÉFONO
        // 1. Header (configurado explícitamente)
        const headerPhone = req.headers.get('x-user-number');

        // 2. Metadatos de Retell (si Args Only = OFF)
        // Retell suele enviar: { args: {...}, call: { from_number: "..." } }
        const retellFromNumber = body.call?.from_number || body.from_number;

        // 3. Argumentos de la función (si la IA lo adivinó)
        const argsPhone = body.phone || body.args?.phone || body.arguments?.phone;

        // SELECCIÓN DEL TELÉFONO REAL
        // Prioridad: Header > Retell Metadata > IA Args
        let searchPhone = headerPhone;

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = retellFromNumber;
        }

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = argsPhone;
        }

        // Limpieza final
        if (searchPhone === 'null' || searchPhone === 'undefined') searchPhone = null;

        const bodyName = body.name || body.args?.name || body.arguments?.name;

        console.log(`[Search Proxy] Extraction Result -> Header: '${headerPhone}', RetellMeta: '${retellFromNumber}', AIArgs: '${argsPhone}' => FINAL USED: '${searchPhone}'`);

        // CONSTRUCCIÓN DE LA LLAMADA A SATFLOW
        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");

        if (bodyName && bodyName.length > 2) {
            satflowUrl.searchParams.set("name", bodyName);
        } else if (searchPhone && searchPhone.length > 5) { // Mínimo de longitud para no buscar mierda
            satflowUrl.searchParams.set("phone", searchPhone);
        } else {
            console.log("[Search Proxy] ⚠️ No valid search criteria found.");
            // Si no hay nada, devolvemos success:false pero sin error 500 para no romper el flujo
            return NextResponse.json({ found: false });
        }

        console.log(`[Search Proxy] Buscando en SatFlow: ${satflowUrl.toString()}`);

        const authHeader = req.headers.get('authorization');
        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        if (!apiResponse.ok) {
            console.warn(`[Search Proxy] SatFlow Error ${apiResponse.status}`);
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