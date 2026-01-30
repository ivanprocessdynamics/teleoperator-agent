import * as admin from 'firebase-admin';

let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log(`[Admin SDK] Init check: ProjectID=${!!projectId}, Email=${!!clientEmail}, KeyLength=${privateKey?.length}`);

    if (privateKey && clientEmail && projectId) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: formatPrivateKey(privateKey),
                }),
            });
            console.log(`[Admin SDK] Firebase Admin Initialized successfully. Project: ${projectId}`);
        } catch (error) {
            console.error('Firebase Admin initialization failed:', error);
        }
    } else {
        console.warn('Firebase Admin: Missing environment variables (FIREBASE_PRIVATE_KEY, etc)');
    }
}

// Only assign if initialization succeeded or app exists
if (admin.apps.length) {
    adminDb = admin.firestore();
    adminAuth = admin.auth();
} else {
    console.error('[Admin SDK] Failed to initialize adminDb');
}

export { adminDb, adminAuth };


