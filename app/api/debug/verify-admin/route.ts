import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
    try {
        const envStatus = {
            projectId: !!process.env.FIREBASE_PROJECT_ID,
            clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: !!process.env.FIREBASE_PRIVATE_KEY ? "Present (Length: " + process.env.FIREBASE_PRIVATE_KEY.length + ")" : "Missing",
        };

        if (!adminDb) {
            return NextResponse.json({
                status: "error",
                message: "Admin SDK not initialized",
                env: envStatus
            }, { status: 500 });
        }

        // Try a read operation
        const testDoc = await adminDb.collection("test_connectivity").limit(1).get();

        return NextResponse.json({
            status: "success",
            message: "Admin SDK connected and read successful",
            env: envStatus,
            readResult: testDoc.empty ? "Empty (Success)" : "Found docs (Success)"
        });

    } catch (error: any) {
        return NextResponse.json({
            status: "error",
            message: "Exception during verification",
            error: error.message
        }, { status: 500 });
    }
}
