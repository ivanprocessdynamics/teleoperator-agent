import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * API Route to migrate existing workspaces by adding owners as members.
 * This is a one-time migration utility.
 * 
 * GET /api/admin/migrate-workspace-members
 * 
 * Query params:
 * - superadminUid: Required. UID of the superadmin to authorize the request.
 * - addSuperadmin: Optional. If "true", also adds the superadmin to all workspaces.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const superadminUid = searchParams.get("superadminUid");
    const addSuperadmin = searchParams.get("addSuperadmin") === "true";

    if (!superadminUid) {
        return NextResponse.json({ error: "superadminUid is required" }, { status: 400 });
    }

    // Verify superadmin
    const userDoc = await getDoc(doc(db, "users", superadminUid));
    if (!userDoc.exists() || userDoc.data().role !== "superadmin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const superadminData = userDoc.data();

    try {
        const workspacesSnap = await getDocs(collection(db, "workspaces"));
        const results: { workspaceId: string; ownerId: string; added: string[] }[] = [];

        for (const wsDoc of workspacesSnap.docs) {
            const wsData = wsDoc.data();
            const ownerUid = wsData.owner_uid;
            const added: string[] = [];

            // Check if owner is in members subcollection
            if (ownerUid) {
                const ownerMemberRef = doc(db, "workspaces", wsDoc.id, "members", ownerUid);
                const ownerMemberSnap = await getDoc(ownerMemberRef);

                if (!ownerMemberSnap.exists()) {
                    // Fetch owner info from users collection
                    const ownerUserSnap = await getDoc(doc(db, "users", ownerUid));
                    const ownerEmail = ownerUserSnap.exists() ? ownerUserSnap.data().email : null;

                    await setDoc(ownerMemberRef, {
                        uid: ownerUid,
                        email: ownerEmail || "unknown",
                        role: "admin",
                        joined_at: serverTimestamp(),
                        migrated: true
                    });
                    added.push(`owner:${ownerUid}`);
                }
            }

            // Optionally add superadmin to all workspaces
            if (addSuperadmin && superadminUid !== ownerUid) {
                const superadminMemberRef = doc(db, "workspaces", wsDoc.id, "members", superadminUid);
                const superadminMemberSnap = await getDoc(superadminMemberRef);

                if (!superadminMemberSnap.exists()) {
                    await setDoc(superadminMemberRef, {
                        uid: superadminUid,
                        email: superadminData.email || "unknown",
                        role: "admin",
                        joined_at: serverTimestamp(),
                        migrated: true
                    });
                    added.push(`superadmin:${superadminUid}`);
                }
            }

            if (added.length > 0) {
                results.push({
                    workspaceId: wsDoc.id,
                    ownerId: ownerUid,
                    added
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete. Updated ${results.length} workspaces.`,
            results
        });
    } catch (error) {
        console.error("Migration error:", error);
        return NextResponse.json({ error: "Migration failed", details: String(error) }, { status: 500 });
    }
}
