import { auth } from '@/lib/firebase';

/**
 * Fetch wrapper that automatically attaches the Firebase ID token
 * as a Bearer token in the Authorization header.
 * 
 * Usage:
 *   const res = await authFetch('/api/web/training-analysis', {
 *     method: 'POST',
 *     body: JSON.stringify({ subworkspaceId }),
 *   });
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const currentUser = auth.currentUser;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (currentUser) {
        try {
            const token = await currentUser.getIdToken();
            headers.set('Authorization', `Bearer ${token}`);
        } catch (err) {
            console.error('[authFetch] Failed to get ID token:', err);
        }
    }

    return fetch(url, {
        ...options,
        headers,
    });
}
