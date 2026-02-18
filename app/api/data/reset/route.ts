import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth-middleware";

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { type, id } = await req.json();

        if (!id || !['campaign', 'subworkspace'].includes(type)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        console.log(`[Data Reset] Request to clear data for ${type} ${id}`);

        // Define query based on type
        // We delete from 'calls' collection
        let query;
        if (type === 'campaign') {
            query = adminDb.collection('calls').where('metadata.campaign_id', '==', id);
        } else {
            // subworkspace (inbound agent context)
            // match by subworkspace_id in metadata OR root field (we store it in both depending on version)
            query = adminDb.collection('calls').where('subworkspace_id', '==', id);
        }

        // Batch delete (handle > 500 limits by chunking)
        const batchSize = 400;
        let deletedCount = 0;

        while (true) {
            const snapshot = await query.limit(batchSize).get();
            if (snapshot.empty) break;

            const batch = adminDb.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deletedCount += snapshot.size;
            console.log(`[Data Reset] Deleted batch of ${snapshot.size} calls...`);
        }

        console.log(`[Data Reset] Completed. Total deleted: ${deletedCount}`);

        return NextResponse.json({
            success: true,
            deletedCount
        });

    } catch (error: any) {
        console.error("[Data Reset] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
