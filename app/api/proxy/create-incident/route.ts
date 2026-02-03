
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 1. Interceptamos la dirección "sucia"
        // Extraemos 'address' y mantenemos el resto de campos (restOfBody)
        let { address, ...restOfBody } = body;

        console.log(`[Create Incident Proxy] Recibido: ${JSON.stringify(body)}`);

        // 2. VALIDACIÓN GOOGLE (Tarda ~100ms, imperceptible)
        // Solo validamos si viene una dirección
        let finalAddress = address;
        if (address) {
            console.log(`[Create Incident Proxy] Validando dirección: '${address}'...`);
            finalAddress = await validateAddress(address);
            console.log(`[Create Incident Proxy] Dirección final: '${finalAddress}'`);
        }

        // 3. Enviamos a SatFlow la dirección LIMPIA
        const targetUrl = "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents";
        const authHeader = req.headers.get('authorization');

        const satflowPayload = {
            ...restOfBody,
            location: finalAddress, // SatFlow usa 'location' o 'address'? En el update usaban... body directo.
            // En update-incident se enviaba `fieldsToUpdate` directo.
            // Si el body original tenía 'address', y SatFlow espera 'location', aquí hacemos el mapping.
            // Si SatFlow espera 'address', entonces ponemos address: finalAddress.
            // Asumiré 'address' si el usuario envió 'address', pero el usuario puso `location: finalAddress` en su ejemplo.
            // Revisando get-last-incident, devuelve `address: lastIncident.location`.
            // Así que SatFlow probablemente usa 'location'.
            address: finalAddress, // Por si acaso Retell espera address en retorno
        };

        // CORRECCION: El usuario en su ejemplo puso `location: finalAddress`.
        // Pero `restOfBody` viene de Retell. Retell suele enviar lo que definas en la Tool.
        // Si definiste 'address' en la tool, llega 'address'.
        // Si SatFlow espera 'location', debemos mapearlo.
        // Voy a añadir 'location' explícitamente y mantener 'address' por si acaso, o mejor, ver qué espera SatFlow.
        // En `get-last-incident` vimos `address: lastIncident.location`. O sea SatFlow guarda en `location`.

        const payloadToSend = {
            ...restOfBody,
            location: finalAddress,
            address: finalAddress
        };

        console.log(`[Create Incident Proxy] Enviando a SatFlow...`);

        const apiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify(payloadToSend)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`[Create Incident Proxy] SatFlow Error ${apiResponse.status}: ${errorText}`);
            return NextResponse.json({ error: "SatFlow Error", details: errorText }, { status: apiResponse.status });
        }

        const data = await apiResponse.json();
        // data.id debería venir aquí

        // 4. RETORNO CRÍTICO A RETELL
        // Devolvemos la 'address' corregida para que la IA actualice su memoria
        return NextResponse.json({
            success: true,
            id: data.id || "UNKNOWN_ID",
            address: finalAddress, // <--- ¡Importante! Devolvemos la corregida
            status: "created",
            ...data
        });

    } catch (error: any) {
        console.error("[Create Incident Proxy] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
