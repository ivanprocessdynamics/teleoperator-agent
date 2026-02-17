
import { NextRequest, NextResponse } from 'next/server';
import { SATFLOW_BASE_URL } from '@/lib/constants';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId, address, token } = body;

        // 1. Validaciones
        if (!incidentId || !address) {
            return NextResponse.json(
                { error: "Missing incidentId or address" },
                { status: 400 }
            );
        }

        // 2. Verify OTP token
        if (!token || !adminDb) {
            return NextResponse.json(
                { error: "Verification required" },
                { status: 403 }
            );
        }

        const sessionDoc = await adminDb.collection('otp_sessions').doc(incidentId).get();
        if (!sessionDoc.exists) {
            return NextResponse.json({ error: "Session not found" }, { status: 403 });
        }

        const session = sessionDoc.data()!;
        const tokenExpiry = session.token_expires_at?.toDate?.() || new Date(session.token_expires_at);

        if (session.verified_token !== token || new Date() > tokenExpiry) {
            return NextResponse.json(
                { error: "Invalid or expired verification. Please verify again." },
                { status: 403 }
            );
        }

        // 3. Build SatFlow URL
        const targetUrl = `${SATFLOW_BASE_URL}/incidents/${incidentId}`;

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
