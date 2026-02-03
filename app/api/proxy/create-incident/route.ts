
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Create Incident] Body recibido:", body);

        // 1. Normalización de la dirección (acepta address o location)
        let rawAddress = body.address || body.location || "";
        let finalAddress = rawAddress;

        // 2. Validación con Google Maps (Si hay dirección)
        let validationDebug: any = null;
        if (rawAddress && rawAddress.length > 5) {
            console.log(`[Create Incident] Validando dirección: ${rawAddress}`);
            const result = await validateAddress(rawAddress);
            finalAddress = result.address;
            validationDebug = result.debug;
            console.log(`[Create Incident] Dirección corregida: ${finalAddress}`);
        }

        // 3. Preparar Payload para SatFlow (USANDO LA DIRECCIÓN CORREGIDA)
        // Eliminamos 'address' si existe para no duplicar, y forzamos 'location'
        const { address, location, ...restOfBody } = body;

        const satflowPayload = {
            ...restOfBody,
            location: finalAddress, // <--- AQUÍ VA LA CORREGIDA
        };

        // 4. Enviar a SatFlow
        // (Asegúrate de usar tu URL y Headers correctos aquí)
        const satflowUrl = "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents";
        const authHeader = req.headers.get('authorization');

        const apiResponse = await fetch(satflowUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify(satflowPayload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("[Create Incident] Error SatFlow:", data);
            return NextResponse.json(data, { status: apiResponse.status });
        }

        // 5. RESPUESTA CRÍTICA A RETELL
        // Debemos devolver la dirección corregida para que la IA actualice su contexto
        return NextResponse.json({
            success: true,
            data: {
                ...data.data, // Los datos que devolvió SatFlow
                location: finalAddress // FORZAMOS la dirección corregida por si SatFlow no la devolvió actualizada
            },
            validationDebug, // <--- EXPOSE DEBUG INFO HERE
            message: "Incident created successfully"
        });

    } catch (error: any) {
        console.error("[Create Incident] Error interno:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
