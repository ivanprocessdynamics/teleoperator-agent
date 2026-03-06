import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { incidentId, token, scorePunctuality, scoreTreatment, scoreResolution, comments } = body;

        if (!incidentId || !scorePunctuality || !scoreTreatment || !scoreResolution) {
            return NextResponse.json({ error: "Missing score fields" }, { status: 400 });
        }

        // Verify OTP token (Security Layer)
        if (!token || !adminDb) {
            return NextResponse.json({ error: "Verification required" }, { status: 403 });
        }

        const sessionDoc = await adminDb.collection('otp_sessions').doc(incidentId).get();
        if (!sessionDoc.exists) {
            return NextResponse.json({ error: "Session not found" }, { status: 403 });
        }

        const session = sessionDoc.data()!;
        const tokenExpiry = session.token_expires_at?.toDate?.() || new Date(session.token_expires_at);

        if (session.verified_token !== token || new Date() > tokenExpiry) {
            return NextResponse.json({ error: "Invalid or expired verification. Please verify again." }, { status: 403 });
        }

        const globalScore = (Number(scorePunctuality) + Number(scoreTreatment) + Number(scoreResolution)) / 3.0;

        // Extract Agent ID to bind this feedback directly to the operator (from the original call)
        let agentIdForFeedback = 'unknown';
        
        try {
            // Check incident doc directly
            const incSnap = await adminDb.collection('incidents').doc(incidentId).get();
            if (incSnap.exists) {
                 const callId = incSnap.data()?.call_id;
                 if (callId) {
                       const callDoc = await adminDb.collection('calls').doc(callId).get();
                       agentIdForFeedback = callDoc.data()?.agent_id || 'unknown';
                 }
            }
        } catch(e){}

        // Save Feedback
        await adminDb.collection('feedbacks').add({
            incident_id: incidentId,
            agent_id: agentIdForFeedback,
            score_punctuality: Number(scorePunctuality),
            score_treatment: Number(scoreTreatment),
            score_resolution: Number(scoreResolution),
            global_score: globalScore,
            comments: comments || '',
            created_at: Date.now()
        });

        // Mark OTP as consumed fully so this cannot be double-submitted
        await sessionDoc.ref.update({
             verified_token: null 
        });

        return NextResponse.json({ success: true, message: "Feedback saved" });

    } catch (error: any) {
        console.error("[Submit Feedback] Critical Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
