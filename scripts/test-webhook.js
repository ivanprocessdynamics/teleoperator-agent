const fetch = require('node-fetch'); // You might need to install this: npm install node-fetch
// Or if using Node 18+, native fetch is available.

// --- CONFIGURATION ---
const PORT = 3000;
const AGENT_ID = "agent_0a3d3ae5da45959c3e7f723905";
const CALL_ID = "call_" + Date.now();
// ---------------------

async function run() {
    console.log(`Simulating Webhook for Call: ${CALL_ID} | Agent: ${AGENT_ID}`);

    if (AGENT_ID === "YOUR_AGENT_ID_HERE") {
        console.error("❌ PLEASE SET YOUR_AGENT_ID_HERE IN THE SCRIPT.");
        console.log("You can find the Agent ID in the Testing Environment UI.");
        return;
    }

    const payload = {
        event: "call_ended",
        call_id: CALL_ID,
        call: {
            call_id: CALL_ID,
            agent_id: AGENT_ID,
            call_status: "ended",
            start_timestamp: Date.now() - 60000, // 1 min ago
            end_timestamp: Date.now(),
            duration_ms: 60000,
            transcript_object: [
                { role: "agent", content: "Hola, soy tu asistente virtual. ¿En qué puedo ayudarte?" },
                { role: "user", content: "Quiero agendar una cita para mañana." },
                { role: "agent", content: "Claro, tengo espacio a las 10am. ¿Te sirve?" },
                { role: "user", content: "Sí, perfecto." },
                { role: "agent", content: "Listo, cita agendada. ¡Hasta luego!" }
            ],
            disconnection_reason: "user_hangup"
        }
    };

    try {
        const response = await fetch(`http://localhost:${PORT}/api/retell/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response:", response.status, data);

        if (response.ok) {
            console.log("✅ Webhook sent successfully! Check your Firestore and Call History.");
        } else {
            console.error("❌ Webhook failed:", data);
        }

    } catch (error) {
        console.error("❌ Error sending webhook:", error.message);
        console.log("Make sure your Next.js server is running on port " + PORT);
    }
}

run();
