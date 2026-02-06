
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';
import { cleanAddressWithAI } from '@/app/lib/addressCleaner';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Create Incident] Body recibido:", body);

        // --- 1. GESTIÓN DE FECHA y HORA (Robustez Extrema) ---
        const finalDate = body.scheduledDate || new Date().toISOString().split('T')[0];
        const finalTime = body.scheduledTime || "09:00";

        // --- 2. GESTIÓN DE TELÉFONO (SUPRA-ROBUSTA) ---
        // 1. Header X (Prioridad alta manual)
        const headerPhone = req.headers.get('x-user-number');

        // 2. Metadatos Retell (si Args Only = OFF)
        const retellFromNumber = body.call?.from_number || body.from_number;

        // 3. Argumentos IA
        const argsPhone = body.contactPhone || body.phone;

        let finalPhone = headerPhone;

        if (!finalPhone || finalPhone === 'UNREGISTERED' || finalPhone === 'null') {
            finalPhone = retellFromNumber;
        }
        if (!finalPhone || finalPhone === 'UNREGISTERED' || finalPhone === 'null') {
            finalPhone = argsPhone;
        }

        // Limpieza final
        if (finalPhone === 'null' || finalPhone === 'undefined' || finalPhone === 'UNREGISTERED') {
            finalPhone = null;
        }

        // FALLBACK DUMMY (Si falla todo, evitar 400)
        if (!finalPhone || finalPhone.trim() === "") {
            console.warn("[Create Incident] ⚠️ NO phone detected (Header/Body/Meta empty). Using fallback '000000000'.");
            finalPhone = "000000000";
        }

        console.log(`[Create Incident] Inputs -> Header: ${headerPhone}, RetellMeta: ${retellFromNumber}, Args: ${argsPhone}`);
        console.log(`[Create Incident] Final Sanitized -> Phone: ${finalPhone}, Date: ${finalDate}, Time: ${finalTime}`);

        // --- 3. GESTIÓN DE DIRECCIÓN ---
        let rawAddress = body.address || body.location || "";
        let finalAddress = rawAddress;
        let validationDebug: any = { original: rawAddress };

        if (rawAddress && rawAddress.length > 3) {
            // A. Limpieza Fonética con IA
            const aiCleaned = await cleanAddressWithAI(rawAddress);
            validationDebug.aiCleaned = aiCleaned;

            // B. Geocoding con Google Maps
            const result = await validateAddress(aiCleaned);
            finalAddress = result.address;
            validationDebug.googleResult = result.debug;

            console.log(`[Create Incident] Address Pipeline: '${rawAddress}' -> '${finalAddress}'`);
        }

        // --- 4. GESTIÓN DE CLIENTE (LEAD) ---
        let clientId = body.clientId;
        const satflowBaseUrl = "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1";
        const authHeader = req.headers.get('authorization');
        const headers = {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {})
        };

        // Si clientId es "UNREGISTERED", intenta crear Lead con el teléfono detectado
        if ((!clientId || clientId === 'UNREGISTERED') && finalPhone !== "000000000") {
            console.log(`[Create Incident] Client ID is missing/unregistered. Attempting to create Lead for ${finalPhone}...`);
            try {
                const createClientRes = await fetch(`${satflowBaseUrl}/customers`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        name: body.clientName || "Cliente Web/Voces",
                        phone: finalPhone,
                        address: finalAddress,
                    })
                });

                if (createClientRes.ok) {
                    const clientData = await createClientRes.json();
                    const newId = clientData.id || clientData.data?.id || clientData._id;
                    if (newId) {
                        clientId = newId;
                        console.log(`[Create Incident] New Client created with ID: ${clientId}`);
                    }
                } else {
                    console.warn(`[Create Incident] Failed to create lead: ${await createClientRes.text()}`);
                }
            } catch (e) {
                console.error("[Create Incident] Error creating lead:", e);
            }
        }

        // --- 5. ENVIAR A SATFLOW (POST) ---
        const { address, location, status, phone, contactPhone, scheduledDate, scheduledTime, ...restOfBody } = body;

        const satflowPayload = {
            ...restOfBody,
            clientId: clientId, // Usamos el ID (existente o nuevo)
            location: finalAddress,
            phone: finalPhone,      // SANITIZED
            scheduledDate: finalDate, // SANITIZED
            scheduledTime: finalTime  // SANITIZED
        };

        const apiResponse = await fetch(`${satflowBaseUrl}/incidents`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(satflowPayload)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("[Create Incident] Error SatFlow (POST):", data);
            return NextResponse.json(data, { status: apiResponse.status });
        }

        const incidentId = data.id || data.data?.id || (data._id);
        let finalStatus = 'pending';

        // --- 6. GESTIÓN DE ESTADO (RESOLVED) ---
        if (status === 'resolved' && incidentId) {
            console.log(`[Create Incident] Status is 'resolved'. Patching incident ${incidentId}...`);
            try {
                const patchUrl = `${satflowBaseUrl}/incidents/${incidentId}`;
                const patchResponse = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({ status: 'resolved' })
                });

                if (patchResponse.ok) {
                    console.log(`[Create Incident] Successfully patched ${incidentId} to resolved.`);
                    finalStatus = 'resolved';
                }
            } catch (patchError) {
                console.error(`[Create Incident] Exception patching incident:`, patchError);
            }
        }

        // --- 7. RESPUESTA ---
        return NextResponse.json({
            success: true,
            data: {
                ...data.data,
                location: finalAddress,
                status: finalStatus,
                phone: finalPhone,
                scheduledDate: finalDate,
                scheduledTime: finalTime
            },
            validationDebug,
            message: finalStatus === 'resolved' ? "Incident created and resolved successfully" : "Incident created successfully"
        });

    } catch (error: any) {
        console.error("[Create Incident] Error interno:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
