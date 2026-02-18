import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export interface AuthResult {
    uid: string;
    email?: string;
}

/**
 * Verify Firebase ID token from Authorization header.
 * Returns user data if valid, null otherwise.
 * 
 * Usage in API routes:
 *   const user = await verifyAuth(req);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult | null> {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return null;

        const token = authHeader.replace('Bearer ', '');
        if (!token) return null;

        if (!adminAuth) {
            console.error('[Auth] adminAuth not initialized');
            return null;
        }

        const decoded = await adminAuth.verifyIdToken(token);
        return { uid: decoded.uid, email: decoded.email };
    } catch (err) {
        console.error('[Auth] Token verification failed:', err);
        return null;
    }
}

/**
 * Simple in-memory rate limiter for expensive operations.
 * Tracks requests per key (IP or user ID) within a time window.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
    key: string,
    maxRequests: number = 10,
    windowMs: number = 60_000
): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true; // allowed
    }

    if (entry.count >= maxRequests) {
        return false; // blocked
    }

    entry.count++;
    return true; // allowed
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore) {
            if (now > entry.resetAt) rateLimitStore.delete(key);
        }
    }, 5 * 60_000);
}
