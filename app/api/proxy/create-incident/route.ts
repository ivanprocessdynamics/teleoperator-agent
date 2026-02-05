
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

        // 3. Preparar Payload para SatFlow
        // Eliminamos 'address' para no duplicar y 'status' para que se cree como pending por defecto
        const { address, location, status, ...restOfBody } = body;

        const satflowPayload = {
            ...restOfBody,
            location: finalAddress, // Usamos la dirección corregida
        };

        // 4. Enviar a SatFlow (POST - Creará el incidente en PENDING)
        const satflowUrl = "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents";
        const authHeader = req.headers.get('authorization');
        const headers = {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {})
        };

        const apiResponse = await fetch(satflowUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(satflowPayload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("[Create Incident] Error SatFlow (POST):", data);
            return NextResponse.json(data, { status: apiResponse.status });
        }

        const incidentId = data.id || data.data?.id || (data._id); // Intentar obtener ID de varios sitios posibles
        let finalStatus = 'pending'; // Estado por defecto

        // 5. SI EL ESTADO SOLICITADO ES 'RESOLVED', HACEMOS PATCH INMEDIATO
        if (status === 'resolved' && incidentId) {
            console.log(`[Create Incident] Status is 'resolved'. Patching incident ${incidentId}...`);
            try {
                const patchUrl = `${satflowUrl}/${incidentId}`;
                const patchResponse = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({ status: 'resolved' })
                });

                if (patchResponse.ok) {
                    console.log(`[Create Incident] Successfully patched ${incidentId} to resolved.`);
                    finalStatus = 'resolved';
                } else {
                    console.error(`[Create Incident] Failed to patch ${incidentId} to resolved.`, await patchResponse.text());
                }
            } catch (patchError) {
                console.error(`[Create Incident] Exception patching incident:`, patchError);
            }
        }

        // 6. RESPUESTA CRÍTICA A RETELL
        return NextResponse.json({
            success: true,
            data: {
                ...data.data,
                location: finalAddress,
                status: finalStatus // Devolvemos el estado real (pending o resolved)
            },
            validationDebug,
            message: finalStatus === 'resolved' ? "Incident created and resolved successfully" : "Incident created successfully"
        });

    } catch (error: any) {
        console.error("[Create Incident] Error interno:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
