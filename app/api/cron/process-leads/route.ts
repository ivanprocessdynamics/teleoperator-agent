import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const SENDER_ID = "SatFlow";

// Utility to shorten URLs precisely like the other proxy
async function shortenUrl(longUrl: string): Promise<string> {
    try {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (response.ok) {
            return await response.text();
        }
        return longUrl;
    } catch (e) {
        return longUrl;
    }
}

export async function GET(req: NextRequest) {
    try {
        // Very basic security: Vercel Cron sends a secret header. We could also just allow hitting it publicly if it's safe pseudo-idempotent logic.
        // For standard local dev, we won't strictly block it, but in prod consider validating checking req.headers.get('Authorization').
        
        // 1. Check current time in Spain
        const nowES = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
        const currentHour = nowES.getHours();
        
        // Between 22:00 and 08:00 (0..7), abort or pause sending.
        // If it's night time, the cron just exits successfully and will re-evaluate on the next tick at 08:00
        if (currentHour >= 22 || currentHour < 8) {
            console.log(`[Cron process-leads] Skipped execution due to restricted hours (Current ES hour: ${currentHour})`);
            return NextResponse.json({ status: "skipped_night_hours", hour: currentHour });
        }
        
        if (!adminDb) {
             return NextResponse.json({ error: "Database not available" }, { status: 500 });
        }

        // 2. Look for leads that haven't been sent a follow-up and are older than 8 hours
        const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
        
        const leadsSnapshot = await adminDb.collection('calls')
            .where('is_potential_lead', '==', true)
            .where('follow_up_sms_sent', '==', false)
            .get();

        if (leadsSnapshot.empty) {
            return NextResponse.json({ status: "ok", processed: 0, message: "No pendings to process." });
        }

        const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://teleoperator-agent.vercel.app";
        const client = twilio(accountSid, authToken);
        let processedCount = 0;

        // 3. Process matching leads
        for (const doc of leadsSnapshot.docs) {
            const lead = doc.data();
            
            if (lead.start_timestamp <= eightHoursAgo && lead.caller_phone) {
                 // Prepare SMS
                 const targetPhone = lead.caller_phone;
                 
                 // Generate the unique link. Uses the Call doc ID as the secure token anchor.
                 const longLink = `${BASE_URL}/reportar-averia?id=${doc.id}`;
                 const correctionLink = await shortenUrl(longLink);

                 const messageBody = `Te contactamos hace unas horas. ¿Sigues teniendo la avería técnica reportada?\n\nPuedes volver a llamarnos o rellenar este formulario para brindarnos todos los detalles rápidamente y agilizar tu trámite:\n${correctionLink}`;

                 try {
                     // Insert the Lead Phone into `otp_sessions` precisely using the same scheme so the /reportar-averia page OTP step works seamlessly wrapper
                     await adminDb.collection('otp_sessions').doc(doc.id).set({
                        phone: targetPhone,
                        created_at: new Date(),
                     }, { merge: true });

                     try {
                         await client.messages.create({
                             body: messageBody,
                             from: SENDER_ID,
                             to: targetPhone
                         });
                     } catch (twilioErr: any) {
                        if (twilioErr.code === 21212 || twilioErr.code === 21612) {
                            await client.messages.create({
                                body: messageBody,
                                from: twilioNumber,
                                to: targetPhone
                            });
                        } else {
                            throw twilioErr;
                        }
                     }
                     
                     // 4. Update the trigger flag
                     await doc.ref.update({
                         follow_up_sms_sent: true,
                         follow_up_sms_timestamp: Date.now()
                     });

                     processedCount++;
                 } catch (innerErr) {
                     console.error(`[Cron process-leads] Failed sending to lead ${doc.id}:`, innerErr);
                 }
            }
        }

        return NextResponse.json({ status: "ok", processed: processedCount });

    } catch (error: any) {
        console.error("[Cron process-leads] Critical Error:", error);
        return NextResponse.json({ error: "Internal Error", details: error?.message }, { status: 500 });
    }
}
