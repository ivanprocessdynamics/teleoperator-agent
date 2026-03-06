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
        // Standard timezone logic or raw. 
        if (!adminDb) {
             return NextResponse.json({ error: "Database not available" }, { status: 500 });
        }

        // We check incidents where feedback SMS hasn't been sent.
        const incidentsSnapshot = await adminDb.collection('incidents')
            .where('feedback_sms_sent', '!=', true) // Equivalent logic requires an index or just boolean checks 1 by 1
            // Firebase limits != queries, a simpler approach is where('feedback_sms_sent', '==', false)
            .get();

        if (incidentsSnapshot.empty) {
            console.log("No feedback targets")
            // Re-poll correctly using exact boolean
        }

        const validSnapshot = await adminDb.collection('incidents')
            .where('feedback_sms_sent', '==', false)
            .get();

        const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://teleoperator-agent.vercel.app";
        const client = twilio(accountSid, authToken);
        let processedCount = 0;
        const now = Date.now();
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

        for (const doc of validSnapshot.docs) {
            const data = doc.data();
            
            // Reconstruct the appointment datetime
            // data.scheduled_date is "YYYY-MM-DD", data.scheduled_time is "HH:MM"
            if (!data.scheduled_date || !data.scheduled_time || !data.contact_phone) continue;

            try {
                // Warning: assuming Europe/Madrid mapping initially (could be timezone-adjusted manually, keeping simple JS native Date parsing which is local to vercel)
                // "2024-05-10T14:30:00"
                const scheduledDateRaw = `${data.scheduled_date}T${data.scheduled_time}:00`;
                const scheduledTimeMs = new Date(scheduledDateRaw).getTime();

                // Validation: Ensure valid date
                if (isNaN(scheduledTimeMs)) continue;

                const timeSinceAppointment = now - scheduledTimeMs;

                // Send SMS if exactly >= 4 hours have passed since the appointment time
                // And we haven't sent it yet.
                // Note: We don't send if >48 hours have passed (too late/bugged).
                if (timeSinceAppointment >= FOUR_HOURS_MS && timeSinceAppointment <= (48 * 60 * 60 * 1000)) {
                     const targetPhone = data.contact_phone;
                     const longLink = `${BASE_URL}/resenas?id=${doc.id}`;
                     const shortenLinkResult = await shortenUrl(longLink);

                     const messageBody = `Esperamos que la asistencia haya resultado de utilidad. Ayúdanos publicando tu reseña mediante este formulario seguro:\n${shortenLinkResult}\n\nGracias por su confianza.`;

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
                     
                     await doc.ref.update({
                         feedback_sms_sent: true,
                         feedback_sms_timestamp: Date.now()
                     });

                     processedCount++;
                }
            } catch (dtErr) {
                console.error("Date compute error on doc ", doc.id);
            }
        }

        return NextResponse.json({ status: "ok", processed: processedCount });

    } catch (error: any) {
        console.error("[Cron process-feedback] Critical Error:", error);
        return NextResponse.json({ error: "Internal Error", details: error?.message }, { status: 500 });
    }
}
