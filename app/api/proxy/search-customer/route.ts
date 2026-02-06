
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
        });

        // ESTRATEGIA SUPRA-ROBUSTA DE EXTRACCIÓN DE TELÉFONO
        const headerPhone = req.headers.get('x-user-number');
        const retellFromNumber = body.call?.from_number || body.from_number;
        const argsPhone = body.phone || body.args?.phone || body.arguments?.phone;

        let searchPhone = headerPhone;

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = retellFromNumber;
        }

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = argsPhone;
        }

        if (searchPhone === 'null' || searchPhone === 'undefined') searchPhone = null;

        const bodyName = body.name || body.args?.name || body.arguments?.name;

        // --- LOG 1: Teléfono Final ---
        console.log(`[Search Proxy] 🔎 FINAL PHONE TO USE: '${searchPhone}' (Source Header: '${headerPhone}', Meta: '${retellFromNumber}', Args: '${argsPhone}')`);

        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");

        if (bodyName && bodyName.length > 2) {
            satflowUrl.searchParams.set("name", bodyName);
        } else if (searchPhone && searchPhone.length > 5) {
            satflowUrl.searchParams.set("phone", searchPhone);
        } else {
            console.log("[Search Proxy] ⚠️ No valid search criteria found.");
            return NextResponse.json({ found: false });
        }

        // --- LOG 2: URL Completa ---
        console.log(`[Search Proxy] 🚀 CALLING SATFLOW URL: ${satflowUrl.toString()}`);

        const authHeader = req.headers.get('authorization');
        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        const data = await apiResponse.json();

        // --- LOG 3: Respuesta SatFlow ---
        console.log(`[Search Proxy] 📥 SATFLOW RESPONSE Status: ${apiResponse.status}`);
        console.log(`[Search Proxy] 📦 SATFLOW BODY:`, JSON.stringify(data, null, 2));

        if (!apiResponse.ok) {
            console.warn(`[Search Proxy] SatFlow Error ${apiResponse.status}`);
            return NextResponse.json({ found: false }, { status: apiResponse.status });
        }

        const customers = data.data || [];

        if (customers.length > 0) {
            const client = customers[0];
            const fullAddress = `${client.street || ''}, ${client.city || ''}`.replace(/^, |, $/g, '');

            console.log(`[Search Proxy] ✅ FOUND CUSTOMER: ${client.id} - ${client.fullName}`);

            return NextResponse.json({
                found: true,
                id: client.id,
                name: client.fullName || client.name,
                address: fullAddress,
                city: client.city,
                email: client.email
            });
        } else {
            console.log(`[Search Proxy] ❌ CLIENT NOT FOUND (Empty array returned)`);
            return NextResponse.json({ found: false });
        }

    } catch (error: any) {
        // --- LOG 4: Error Catch ---
        console.error("[Search Proxy] 🔥 INTERNAL ERROR:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}