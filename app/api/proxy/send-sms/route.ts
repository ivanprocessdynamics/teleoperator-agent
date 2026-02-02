
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio Client
// Ensure these env vars are set in Vercel
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+447366333475';

// "SatFlow" sender ID logic:
// Alphanumeric Sender IDs are supported in many countries (e.g. UK, Spain) but not US/Canada usually.
// If destination is Spain (+34), "SatFlow" usually works if not prohibited by carrier.
// We will try to use "SatFlow". If it fails, we might need fallback logic or just let it error for now as requested.
const SENDER_ID = "SatFlow";

const client = twilio(accountSid, authToken);

export async function POST(req: NextRequest) {
    try {
        let body: any = {};
        try {
            const rawBody = await req.text();
            console.log(`[SMS Proxy] RAW Body: ${rawBody.substring(0, 500)}`); // Log first 500 chars

            if (rawBody) {
                body = JSON.parse(rawBody);
            }
        } catch (e) {
            console.warn("[SMS Proxy] JSON parsing warning:", e);
        }

        // Support Retell 'args' wrapper if present
        const payload = body.args || body;
        const { phone, incidentId, scheduledDate, scheduledTime, address, name } = payload;

        console.log(`[SMS Proxy] Parsed Phone: '${phone}'`);

        // 1. Validation
        if (!phone) {
            return NextResponse.json(
                { error: "Missing 'phone' parameter" },
                { status: 400 }
            );
        }

        // 2. Message Construction
        const messageBody = `Hola ${name || "Cliente"},

Tu visita técnica ha sido confirmada:
📅 Fecha: ${scheduledDate || "Pendiente"}
⏰ Hora: ${scheduledTime || "Pendiente"}
📍 Dirección: ${address || "Sin dirección"}

Ref: ${incidentId || "N/A"}

Si la dirección no es correcta, por favor llámanos lo antes posible.
Gracias.`;

        console.log(`[SMS Proxy] Sending SMS to ${phone} for Incident ${incidentId}`);

        // 3. Send via Twilio
        let message;
        try {
            message = await client.messages.create({
                body: messageBody,
                from: SENDER_ID, // Try alphanumeric first
                to: phone
            });
        } catch (twilioError: any) {
            console.warn("[SMS Proxy] Alphanumeric ID failed or error, retrying with number if 21212/21612...", twilioError.code);
            // Fallback to number if Alphanumeric ID is not supported (Error 21212 or 21612)
            if (twilioError.code === 21212 || twilioError.code === 21612) {
                message = await client.messages.create({
                    body: messageBody,
                    from: twilioNumber,
                    to: phone
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
