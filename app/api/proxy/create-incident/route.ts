
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';
import { cleanAddressWithAI } from '@/app/lib/addressCleaner';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Create Incident] Body recibido:", body);

        // 1. Normalización de la dirección (acepta address o location)
        let rawAddress = body.address || body.location || "";
        let finalAddress = rawAddress;

        // 2. Limpieza IA + Validación Google
        let validationDebug: any = { original: rawAddress };

        if (rawAddress && rawAddress.length > 3) {
            // A. Limpieza Fonética con IA
            const aiCleaned = await cleanAddressWithAI(rawAddress);
            validationDebug.aiCleaned = aiCleaned;

            // B. Geocoding con Google Maps
            const result = await validateAddress(aiCleaned);
            finalAddress = result.address;
            validationDebug.googleResult = result.debug;

            console.log(`[Create Incident] Pipeline: '${rawAddress}' -> AI: '${aiCleaned}' -> Google: '${finalAddress}'`);
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
