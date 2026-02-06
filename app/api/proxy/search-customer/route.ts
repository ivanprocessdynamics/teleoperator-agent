
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
        const bodyName = body.name;
        // 1. PRIORIDAD ABSOLUTA AL HEADER (Caller ID)
        const headerPhone = req.headers.get('x-user-number');

        console.log(`[Search Proxy] Inputs -> Name: '${bodyName}', BodyPhone: '${bodyPhone}', HeaderPhone: '${headerPhone}'`);

        const satflowUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/customers/search");

        let searchPhone = bodyPhone;

        // LÓGICA DE PRIORIDAD CORREGIDA:
        // Si hay headerPhone y es válido (no UNREGISTERED/null), tiene preferencia si el bodyPhone es null/UNREGISTERED
        // O simplemente, si hay headerPhone, usémoslo como fuente confiable si bodyPhone falla.
        // Pero el requerimiento dice: "Si body.phone viene vacío (null) PERO existe x-user-number -> EJECUTA la búsqueda usando el número del header."

        // Vamos a definir 'finalPhone' como la fuente de verdad para teléfono.
        // Asumimos que x-user-number es lo más fiable si está disponible.
        // Pero si el usuario manual (IA) pasó un nombre, buscamos nombre.

        if (headerPhone && headerPhone !== 'UNREGISTERED' && headerPhone !== 'null') {
            // Si el body está vacío o es unregistered, usamos header.
            if (!bodyPhone || bodyPhone === 'UNREGISTERED' || bodyPhone === 'null') {
                searchPhone = headerPhone;
            }
        }

        // DEPURACIÓN
        console.log(`[Search Proxy] Resolved Search Phone: '${searchPhone}'`);

        if (bodyName) {
            satflowUrl.searchParams.set("name", bodyName);
        } else if (searchPhone && searchPhone !== 'UNREGISTERED' && searchPhone !== 'null') {
            satflowUrl.searchParams.set("phone", searchPhone);
        } else {
            console.log("[Search Proxy] No valid criteria found (Phone is null/UNREGISTERED and Name is empty). Returning found: false.");
            return NextResponse.json({ found: false });
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