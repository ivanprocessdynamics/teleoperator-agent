import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { incidentId } = body;

        // Validation
        if (!incidentId) {
            return NextResponse.json(
                { error: "Missing incidentId" },
                { status: 400 }
            );
        }
        if (!adminDb) {
             return NextResponse.json({ error: "Database not available" }, { status: 500 });
        }

        // Publicly fetch limited data to autofill
        const docSnap = await adminDb.collection('calls').doc(incidentId).get();
        if (!docSnap.exists) {
             return NextResponse.json({ error: "Lead Data Not found" }, { status: 404 });
        }

        const data = docSnap.data();
        // Return ONLY non-compromising information suitable for form autofill
        return NextResponse.json({
            success: true,
            phone: data?.caller_phone || "",
        });

    } catch (error: any) {
        console.error("[Get Lead Info] Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
