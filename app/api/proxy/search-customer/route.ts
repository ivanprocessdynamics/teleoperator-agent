
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    // Objeto para acumular trazas de depuración y devolverlas en el JSON
    const debugTrace: any = {
        step: 'init',
        sources: {}
    };

    try {
        let body: any = {};
        try {
            const rawBody = await req.text();
            if (rawBody) body = JSON.parse(rawBody);
        } catch (e) {
            console.log("[Search Proxy] Body vacío o inválido");
            debugTrace.bodyError = "Empty or invalid JSON body";
        }

        console.log("[Search Proxy] Full Body / Headers Debug:", {
            headers: Object.fromEntries(req.headers),
            bodyKeys: Object.keys(body),
        });

        // ESTRATEGIA SUPRA-ROBUSTA DE EXTRACCIÓN DE TELÉFONO
        const headerPhone = req.headers.get('x-user-number');
        const retellFromNumber = body.call?.from_number || body.from_number;
        const argsPhone = body.phone || body.args?.phone || body.arguments?.phone;

        debugTrace.sources = {
            header: headerPhone,
            metadata: retellFromNumber,
            args: argsPhone
        };

        let searchPhone = headerPhone;
        let phoneSource = 'header';

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = retellFromNumber;
            phoneSource = 'metadata';
        }

        if (!searchPhone || searchPhone === 'UNREGISTERED' || searchPhone === 'null') {
            searchPhone = argsPhone;
            phoneSource = 'args';
        }

        if (searchPhone === 'null' || searchPhone === 'undefined') searchPhone = null;

        let bodyName = body.name || body.args?.name || body.arguments?.name;

        // --- FIX CRÍTICO: Limpieza de Nombre "Basura" ---
        // A veces llega "search_customer" o "null" como nombre. Lo ignoramos.
        if (bodyName) {
            const lowerName = bodyName.toLowerCase().trim();
            const invalidNames = ['search_customer', 'search_client', 'buscar_cliente', 'null', 'undefined', 'string'];
            if (invalidNames.includes(lowerName) || lowerName.length < 3) {
                console.warn(`[Search Proxy] 🚮 Ignoring valid-looking garbage name: '${bodyName}'`);
                bodyName = null;
            }
        }

        debugTrace.finalPhone = searchPhone;
        debugTrace.phoneSource = phoneSource;
        debugTrace.finalName = bodyName; // Puede ser null ahora si se limpió

        console.log(`[Search Proxy] 🔎 FINAL PHONE TO USE: '${searchPhone}' (Source ${phoneSource})`);

        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");

        // LÓGICA DE PRIORIDAD CORREGIDA: 
        // Si tenemos un teléfono válido (del header/meta), SIEMPRE intentamos buscar por teléfono primero 
        // porque es un identificador único. Solo buscamos por nombre si NO hay teléfono o si el nombre es muy explícito.

        // CASO 1: Hay teléfono -> Buscar por Teléfono (Prioridad Real)
        if (searchPhone && searchPhone.length > 5) {
            satflowUrl.searchParams.set("phone", searchPhone);
            debugTrace.searchCriteria = 'phone';
        }
        // CASO 2: Solo hay nombre -> Buscar por Nombre
        else if (bodyName && bodyName.length > 2) {
            satflowUrl.searchParams.set("name", bodyName);
            debugTrace.searchCriteria = 'name';
        } else {
            console.log("[Search Proxy] ⚠️ No valid search criteria found.");
            return NextResponse.json({
                found: false,
                _debug: debugTrace
            });
        }

        console.log(`[Search Proxy] 🚀 CALLING SATFLOW URL: ${satflowUrl.toString()}`);
        debugTrace.satflowUrl = satflowUrl.toString();

        const authHeader = req.headers.get('authorization');
        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        const data = await apiResponse.json();

        debugTrace.satflowStatus = apiResponse.status;
        // debugTrace.satflowBody = data; // Opcional: comentar si es muy grande

        console.log(`[Search Proxy] 📥 SATFLOW RESPONSE Status: ${apiResponse.status}`);

        if (!apiResponse.ok) {
            console.warn(`[Search Proxy] SatFlow Error ${apiResponse.status}`);
            return NextResponse.json({
                found: false,
                _debug: debugTrace
            }, { status: apiResponse.status });
        }

        const customers = data.data || [];
        debugTrace.resultsCount = customers.length;

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
                email: client.email,
                _debug: debugTrace // Debug info included
            });
        } else {
            console.log(`[Search Proxy] ❌ CLIENT NOT FOUND (Empty array returned)`);
            return NextResponse.json({
                found: false,
                _debug: debugTrace
            });
        }

    } catch (error: any) {
        console.error("[Search Proxy] 🔥 INTERNAL ERROR:", error);
        return NextResponse.json({
            error: "Internal Error",
            details: String(error),
            _debug: debugTrace
        }, { status: 500 });
    }
}