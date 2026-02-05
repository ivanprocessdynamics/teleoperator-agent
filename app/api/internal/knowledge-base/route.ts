
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// GET: Para que el Dashboard lea el texto actual
export async function GET(req: NextRequest) {
    try {
        if (!adminDb) return NextResponse.json({ error: "DB Error" }, { status: 500 });

        const docSnap = await adminDb.collection('settings').doc('knowledge_base').get();
        const content = docSnap.exists ? docSnap.data()?.content || "" : "";

        return NextResponse.json({ content });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// POST: Para guardar cambios
export async function POST(req: NextRequest) {
    try {
        if (!adminDb) return NextResponse.json({ error: "DB Error" }, { status: 500 });

        const body = await req.json();
        const { content } = body;

        await adminDb.collection('settings').doc('knowledge_base').set({
            content,
            lastUpdated: new Date()
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
}
