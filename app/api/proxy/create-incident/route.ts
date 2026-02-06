
import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/app/lib/googleMaps';
import { cleanAddressWithAI } from '@/app/lib/addressCleaner';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("[Create Incident] Body recibido:", body);

        // --- 1. GESTIÓN DE FECHA ---
        // Si scheduledDate es null, usa hoy.
        if (!body.scheduledDate) {
            body.scheduledDate = new Date().toISOString().split('T')[0];
        }

        // --- 2. GESTIÓN DE TELÉFONO (PRIORIDAD HEADER) ---
        const headerPhone = req.headers.get('x-user-number');
        const bodyPhone = body.phone || body.contactPhone;

        let finalPhone = bodyPhone;
        // Si no hay bodyPhone válido (o es Unregistered/null) y tenemos header, usamos header.
        if (headerPhone && headerPhone !== 'UNREGISTERED' && headerPhone !== 'null') {
            if (!bodyPhone || bodyPhone === 'UNREGISTERED' || bodyPhone === 'null') {
                finalPhone = headerPhone;
            }
        }

        console.log(`[Create Incident] Phones -> Header: ${headerPhone}, Body: ${bodyPhone} => FINAL: ${finalPhone}`);

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

            console.log(`[Create Incident] Pipeline: '${rawAddress}' -> AI: '${aiCleaned}' -> Google: '${finalAddress}'`);
        }

        // --- 4. GESTIÓN DE CLIENTE (LEAD) ---
        let clientId = body.clientId;
        const satflowBaseUrl = "https://us-central1-satflow-d3744.cloudfunctions.net/api/v1";
        const authHeader = req.headers.get('authorization');
        const headers = {
            'Content-Type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {})
        };

        // Si clientId es "UNREGISTERED" (o null/empty), PERO tenemos un teléfono válido,
        // intentamos crear el lead/cliente primero para obtener un ID válido.
        if ((!clientId || clientId === 'UNREGISTERED') && finalPhone && finalPhone !== 'UNREGISTERED') {
            console.log(`[Create Incident] Client ID is missing/unregistered. Attempting to create Lead for ${finalPhone}...`);
            try {
                // Asumimos endpoint POST /customers para crear cliente
                const createClientRes = await fetch(`${satflowBaseUrl}/customers`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        name: body.clientName || "Cliente Web/Voces", // Default name if missing
                        phone: finalPhone,
                        address: finalAddress, // Usamos la dirección ya corregida
                        // Añadir más campos si SatFlow los requiere
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

        // --- PREPARAR PAYLOAD FINAL ---
        const { address, location, status, phone, contactPhone, ...restOfBody } = body;

        const satflowPayload = {
            ...restOfBody,
            clientId: clientId, // Usamos el ID (existente o nuevo)
            location: finalAddress,
            phone: finalPhone, // Enviamos el teléfono bueno explícitamente
            scheduledDate: body.scheduledDate // La fecha (original o hoy)
        };

        // --- 5. ENVIAR A SATFLOW (POST) ---
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
                status: finalStatus
            },
            validationDebug,
            message: finalStatus === 'resolved' ? "Incident created and resolved successfully" : "Incident created successfully"
        });

    } catch (error: any) {
        console.error("[Create Incident] Error interno:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
