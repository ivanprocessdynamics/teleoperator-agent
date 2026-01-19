import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length
    ? initializeApp(firebaseConfig.apiKey ? firebaseConfig : {})
    : getApp();

// Prevent build errors if env vars are missing
let auth: any;
let db: any;
let googleProvider: any;

try {
    if (firebaseConfig.apiKey) {
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
    } else {
        console.warn("Firebase API Key missing. Services not initialized. (OK for build time)");
        // Mock objects to satisfy exports during build
        auth = {};
        db = {};
        googleProvider = {};
    }
} catch (e) {
    console.warn("Error initializing Firebase services:", e);
}

export { app, auth, db, googleProvider };
