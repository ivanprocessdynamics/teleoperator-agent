import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { callId, status } = body;

        if (!callId || !status) {
            return NextResponse.json({ error: 'Missing callId or status' }, { status: 400 });
        }

        const validStatuses = ['new', 'contacted', 'converted', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Database not available' }, { status: 500 });
        }

        await adminDb.collection('calls').doc(callId).update({
            lead_status: status,
            lead_status_updated_at: new Date(),
        });

        console.log(`[Lead Status] Updated ${callId} to ${status}`);

        return NextResponse.json({ success: true, status });

    } catch (error: any) {
        console.error('[Lead Status] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update lead status', details: error.message },
            { status: 500 }
        );
    }
}
