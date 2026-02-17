
import { NextRequest, NextResponse } from 'next/server';
import { SATFLOW_BASE_URL } from '@/lib/constants';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId, address } = body;

        // 1. Validaciones
        if (!incidentId || !address) {
            return NextResponse.json(
                { error: "Missing incidentId or address" },
                { status: 400 }
            );
        }

        // 2. Construir URL SatFlow
        // Usamos el mismo endpoint que 'update-incident'
        const targetUrl = `${SATFLOW_BASE_URL}/incidents/${incidentId}`;

        // Auth Header fijo o variable de entorno (depende de cómo gestionéis la seguridad "pública")
        // Como es un endpoint web público (el formulario), idealmente deberíamos tener una Service Key.
        // Por ahora, asumimos que SatFlow acepta updates sin Auth o usamos una genérica si existe.
        // NOTA: Si SatFlow requiere Auth de usuario, este endpoint fallará sin un token.
        // Asumiremos que funciona como proxy seguro o que el ID es suficiente "secreto" por ahora.

        const satflowPayload = {
            location: address,
            // Opcional: Añadir nota interna
            description: `\n\nACTUALIZACIÓN DIRECCIÓN WEB: El cliente corrigió la dirección a: ${address}`
        };

        // 3. Llamar a SatFlow (PATCH)
        // Usamos la API KEY de entorno para autenticar la petición 'admin'
        const apiKey = process.env.SATFLOW_API_KEY;

        const apiResponse = await fetch(targetUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}` // <--- CLAVE MAESTRA
            },
            body: JSON.stringify(satflowPayload)
        });

        if (apiResponse.ok) {
            return NextResponse.json({ success: true, message: "Address updated" });
        } else {
            const errorText = await apiResponse.text();
            console.error(`[Web Update] SatFlow Error: ${apiResponse.status} - ${errorText}`);
            return NextResponse.json({ error: "Upstream Error", details: errorText }, { status: apiResponse.status });
        }

    } catch (error: any) {
        console.error("[Web Update] Critical Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
