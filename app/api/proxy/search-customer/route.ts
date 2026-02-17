
import { NextRequest, NextResponse } from 'next/server';
import { SATFLOW_BASE_URL } from '@/lib/constants';
import { formatAddressForSpeech } from '@/app/lib/addressFormatter';

export async function POST(req: NextRequest) {
    const isDev = process.env.NODE_ENV !== 'production';

    // Objeto para acumular trazas de depuración (solo en desarrollo)
    const debugTrace: any = isDev ? {
        step: 'init',
        sources: {}
    } : null;

    try {
        let body: any = {};
        try {
            const rawBody = await req.text();
            if (rawBody) body = JSON.parse(rawBody);
        } catch (e) {
            console.log("[Search Proxy] Body vacío o inválido");
            if (isDev) debugTrace.bodyError = "Empty or invalid JSON body";
        }

        console.log("[Search Proxy] Full Body / Headers Debug:", {
            headers: Object.fromEntries(req.headers),
            bodyKeys: Object.keys(body),
        });

        // ESTRATEGIA SUPRA-ROBUSTA DE EXTRACCIÓN DE TELÉFONO
        const headerPhone = req.headers.get('x-user-number');
        const retellFromNumber = body.call?.from_number || body.from_number;
        const argsPhone = body.phone || body.args?.phone || body.arguments?.phone;

        if (isDev) {
            debugTrace.sources = {
                header: headerPhone,
                metadata: retellFromNumber,
                args: argsPhone
            };
        }

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

        if (isDev) {
            debugTrace.finalPhone = searchPhone;
            debugTrace.phoneSource = phoneSource;
            debugTrace.finalName = bodyName;
        }

        console.log(`[Search Proxy] 🔎 FINAL PHONE TO USE: '${searchPhone}' (Source ${phoneSource})`);

        const satflowUrl = new URL(`${SATFLOW_BASE_URL}/customers/search`);

        // LÓGICA DE PRIORIDAD CORREGIDA: 
        // Si tenemos un teléfono válido (del header/meta), SIEMPRE intentamos buscar por teléfono primero 
        // porque es un identificador único. Solo buscamos por nombre si NO hay teléfono o si el nombre es muy explícito.

        // CASO 1: Hay teléfono -> Buscar por Teléfono (Prioridad Real)
        if (searchPhone && searchPhone.length > 5) {
            satflowUrl.searchParams.set("phone", searchPhone);
            if (isDev) debugTrace.searchCriteria = 'phone';
        }
        // CASO 2: Solo hay nombre -> Buscar por Nombre
        else if (bodyName && bodyName.length > 2) {
            satflowUrl.searchParams.set("name", bodyName);
            if (isDev) debugTrace.searchCriteria = 'name';
        } else {
            console.log("[Search Proxy] ⚠️ No valid search criteria found.");
            return NextResponse.json({
                found: false,
                ...(isDev && { _debug: debugTrace })
            });
        }

        console.log(`[Search Proxy] 🚀 CALLING SATFLOW URL: ${satflowUrl.toString()}`);
        if (isDev) debugTrace.satflowUrl = satflowUrl.toString();

        const authHeader = req.headers.get('authorization');
        const apiResponse = await fetch(satflowUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        const data = await apiResponse.json();

        if (isDev) debugTrace.satflowStatus = apiResponse.status;

        console.log(`[Search Proxy] 📥 SATFLOW RESPONSE Status: ${apiResponse.status}`);

        if (!apiResponse.ok) {
            console.warn(`[Search Proxy] SatFlow Error ${apiResponse.status}`);
            return NextResponse.json({
                found: false,
                ...(isDev && { _debug: debugTrace })
            }, { status: apiResponse.status });
        }

        const customers = data.data || [];
        if (isDev) debugTrace.resultsCount = customers.length;

        if (customers.length > 0) {
            const client = customers[0];
            const fullAddress = `${client.street || ''}, ${client.city || ''}`.replace(/^, |, $/g, '');

            // --- FIX PRONUNCIACIÓN ---
            let spokenAddress = fullAddress;
            try {
                // Importación dinámica para asegurar que funciona sin tocar imports globales

                spokenAddress = formatAddressForSpeech(fullAddress);
            } catch (e) {
                console.error("[Search Proxy] Error formatting address:", e);
            }

            console.log(`[Search Proxy] ✅ FOUND CUSTOMER: ${client.id}`);
            console.log(`[Search Proxy] 🗣️ Spoken Address: '${spokenAddress}' (Original: '${fullAddress}')`);

            return NextResponse.json({
                found: true,
                id: client.id,
                name: client.fullName || client.name,
                address: spokenAddress,
                original_address: fullAddress,
                city: client.city,
                email: client.email,
                ...(isDev && { _debug: debugTrace })
            });
        } else {
            console.log(`[Search Proxy] ❌ CLIENT NOT FOUND (Empty array returned)`);
            return NextResponse.json({
                found: false,
                ...(isDev && { _debug: debugTrace })
            });
        }

    } catch (error: any) {
        console.error("[Search Proxy] 🔥 INTERNAL ERROR:", error);
        return NextResponse.json({
            error: "Internal Error",
            details: String(error),
            ...(isDev && { _debug: debugTrace })
        }, { status: 500 });
    }
}