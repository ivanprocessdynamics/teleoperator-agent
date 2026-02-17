import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';
import crypto from 'crypto';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const SENDER_ID = "SatFlow";

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId } = body;

        if (!incidentId) {
            return NextResponse.json({ error: "Missing incidentId" }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: "Database not available" }, { status: 500 });
        }

        // 1. Look up the stored phone from otp_sessions
        const sessionRef = adminDb.collection('otp_sessions').doc(incidentId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return NextResponse.json({ error: "Session not found. The link may have expired." }, { status: 404 });
        }

        const sessionData = sessionDoc.data()!;
        const phone = sessionData.phone;

        if (!phone) {
            return NextResponse.json({ error: "Phone number not available for this session." }, { status: 400 });
        }

        // 2. Check lockout
        if (sessionData.attempts >= MAX_ATTEMPTS) {
            return NextResponse.json({ error: "Too many attempts. Session locked." }, { status: 429 });
        }

        // 3. Generate 6-digit OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = hashCode(otpCode);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // 4. Store hashed OTP
        await sessionRef.update({
            otp_code: otpHash,
            otp_expires_at: expiresAt,
            attempts: 0,  // Reset attempts on new OTP
            verified_token: null,
            token_expires_at: null,
        });

        // 5. Send OTP via Twilio
        const client = twilio(accountSid, authToken);
        const messageBody = `Tu código de verificación es: ${otpCode}\n\nExpira en ${OTP_EXPIRY_MINUTES} minutos.`;

        try {
            await client.messages.create({
                body: messageBody,
                from: SENDER_ID,
                to: phone
            });
        } catch (twilioError: any) {
            // Fallback to number if alphanumeric fails
            if (twilioError.code === 21212 || twilioError.code === 21612) {
                await client.messages.create({
                    body: messageBody,
                    from: twilioNumber,
                    to: phone
                });
            } else {
                throw twilioError;
            }
        }

        // 6. Return masked phone for UI display
        const phoneMask = phone.length > 4
            ? '•'.repeat(phone.length - 4) + phone.slice(-4)
            : '••••';

        console.log(`[Send OTP] Code sent to ${phoneMask} for incident ${incidentId}`);

        return NextResponse.json({
            success: true,
            phoneMask,
            expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
        });

    } catch (error: any) {
        console.error("[Send OTP] Error:", error);
        return NextResponse.json(
            { error: "Failed to send verification code", details: error.message },
            { status: 500 }
        );
    }
}
