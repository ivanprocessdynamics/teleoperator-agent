import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

const MAX_ATTEMPTS = 5;
const TOKEN_EXPIRY_MINUTES = 30;

function hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId, code } = body;

        if (!incidentId || !code) {
            return NextResponse.json({ error: "Missing incidentId or code" }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: "Database not available" }, { status: 500 });
        }

        const sessionRef = adminDb.collection('otp_sessions').doc(incidentId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return NextResponse.json({ error: "Session not found." }, { status: 404 });
        }

        const sessionData = sessionDoc.data()!;

        // 1. Check lockout
        if (sessionData.attempts >= MAX_ATTEMPTS) {
            return NextResponse.json(
                { error: "Demasiados intentos. Sesión bloqueada.", locked: true },
                { status: 429 }
            );
        }

        // 2. Check expiry
        const expiresAt = sessionData.otp_expires_at?.toDate?.() || new Date(sessionData.otp_expires_at);
        if (!sessionData.otp_code || new Date() > expiresAt) {
            return NextResponse.json(
                { error: "El código ha expirado. Solicita uno nuevo.", expired: true },
                { status: 410 }
            );
        }

        // 3. Verify code
        const inputHash = hashCode(code.trim());
        if (inputHash !== sessionData.otp_code) {
            // Increment attempts
            const newAttempts = (sessionData.attempts || 0) + 1;
            await sessionRef.update({ attempts: newAttempts });

            const remaining = MAX_ATTEMPTS - newAttempts;
            if (remaining <= 0) {
                return NextResponse.json(
                    { error: "Demasiados intentos. Sesión bloqueada.", locked: true },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: `Código incorrecto. ${remaining} intento(s) restante(s).`, remaining },
                { status: 401 }
            );
        }

        // 4. Code is valid — generate session token
        const verifiedToken = generateToken();
        const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

        await sessionRef.update({
            verified_token: verifiedToken,
            token_expires_at: tokenExpiresAt,
            otp_code: null, // Invalidate OTP after use
        });

        console.log(`[Verify OTP] Code verified for incident ${incidentId}`);

        return NextResponse.json({
            verified: true,
            token: verifiedToken,
        });

    } catch (error: any) {
        console.error("[Verify OTP] Error:", error);
        return NextResponse.json(
            { error: "Verification failed", details: error.message },
            { status: 500 }
        );
    }
}
