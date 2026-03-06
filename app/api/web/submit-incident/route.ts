import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId, token, clientName, address, scheduledDateTime, issueDetails, phone } = body;

        // 1. Basic validation
        if (!incidentId || !issueDetails) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // 2. Verify OTP token (Security Layer)
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

        // 3. Register the Incident
        await adminDb.collection('incidents').add({
            call_id: incidentId, // The lead's original call reference
            client_name: clientName || '',
            address: address || '',
            scheduled_date_time: scheduledDateTime || '',
            issue_details: issueDetails,
            contact_phone: phone || session.phone,
            status: 'pending',
            created_at: Date.now()
        });

        // 4. Update the Lead status in `calls` mapping to "Converted"
        const callRef = adminDb.collection('calls').doc(incidentId);
        const callSnapshot = await callRef.get();
        
        if (callSnapshot.exists) {
            await callRef.update({
                lead_status: 'converted'
            });
        }

        return NextResponse.json({ success: true, message: "Incident successfully reported" });

    } catch (error: any) {
        console.error("[Submit Incident] Critical Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
