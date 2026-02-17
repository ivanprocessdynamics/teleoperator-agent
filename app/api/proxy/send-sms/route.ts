
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { adminDb } from '@/lib/firebase-admin';

// Initialize Twilio Client
// Ensure these env vars are set in Vercel
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// "SatFlow" sender ID logic:
// Alphanumeric Sender IDs are supported in many countries (e.g. UK, Spain) but not US/Canada usually.
// If destination is Spain (+34), "SatFlow" usually works if not prohibited by carrier.
// We will try to use "SatFlow". If it fails, we might need fallback logic or just let it error for now as requested.
const SENDER_ID = "SatFlow";

const client = twilio(accountSid, authToken);

// Helper to shorten URL
async function shortenUrl(longUrl: string): Promise<string> {
    try {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (response.ok) {
            return await response.text();
        }
        return longUrl;
    } catch (e) {
        console.warn("URL Shortener failed:", e);
        return longUrl;
    }
}

export async function POST(req: NextRequest) {
    try {
        let body: any = {};
        try {
            const rawBody = await req.text();
            console.log(`[SMS Proxy] RAW Body: ${rawBody.substring(0, 500)}`);

            if (rawBody) {
                body = JSON.parse(rawBody);
            }
        } catch (e) {
            console.warn("[SMS Proxy] JSON parsing warning:", e);
        }

        // Support Retell 'args' wrapper if present
        const payload = body.args || body;
        const { phone, incidentId, scheduledDate, scheduledTime, address, name } = payload;

        // --- LÓGICA HÍBRIDA ---
        const targetPhone = phone || req.headers.get('x-user-number');

        console.log(`[SMS Proxy] Parsed Phone: '${phone}' -> Target: '${targetPhone}'`);

        // 1. Validation
        if (!targetPhone) {
            return NextResponse.json(
                { error: "Phone number missing in Body and Headers" },
                { status: 400 }
            );
        }

        // Obtén tu dominio base
        const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://teleoperator-agent.vercel.app";

        // Generamos el enlace único y lo acortamos
        const longLink = `${BASE_URL}/corregir-direccion?id=${incidentId}`;
        const correctionLink = await shortenUrl(longLink);

        // Store phone number in Firestore for OTP verification later
        if (incidentId && adminDb) {
            try {
                await adminDb.collection('otp_sessions').doc(incidentId).set({
                    phone: targetPhone,
                    created_at: new Date(),
                }, { merge: true });
                console.log(`[SMS Proxy] Stored phone for OTP session: ${incidentId}`);
            } catch (dbErr) {
                console.error('[SMS Proxy] Failed to store OTP session:', dbErr);
                // Non-blocking: SMS still gets sent even if storage fails
            }
        }

        // 2. Message Construction
        const refId = incidentId || "N/A";

        const messageBody = `
Hola ${name || "Cliente"}, confirmamos tu visita técnica:
Ref: ${refId}

📅 ${scheduledDate || "Pendiente"}
⏰ ${scheduledTime || "Pendiente"}
📍 ${address || "Sin dirección"}

¿Dirección incorrecta? Corrígela aquí:
${correctionLink}
`.trim();

        console.log(`[SMS Proxy] Sending SMS to ${targetPhone} for Incident ${incidentId}`);

        // 3. Send via Twilio
        let message;
        try {
            message = await client.messages.create({
                body: messageBody,
                from: SENDER_ID, // Try alphanumeric first
                to: targetPhone
            });
        } catch (twilioError: any) {
            console.warn("[SMS Proxy] Alphanumeric ID failed or error, retrying with number if 21212/21612...", twilioError.code);
            // Fallback to number if Alphanumeric ID is not supported (Error 21212 or 21612)
            if (twilioError.code === 21212 || twilioError.code === 21612) {
                message = await client.messages.create({
                    body: messageBody,
                    from: twilioNumber,
                    to: targetPhone
                });
            } else {
                throw twilioError;
            }
        }

        console.log(`[SMS Proxy] SMS Sent. SID: ${message.sid}`);

        return NextResponse.json({
            success: true,
            sid: message.sid,
            status: message.status
        }, { status: 200 });

    } catch (error: any) {
        console.error("[SMS Proxy] Error:", error);
        // Retell friendly error
        return NextResponse.json(
            { error: "SMS Sending Failed", details: error.message },
            { status: 500 }
        );
    }
}
