import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { clientId } = body;

        if (!clientId) {
            return NextResponse.json({ error: "clientId required" }, { status: 400 });
        }

        // 1. Buscamos TODOS los tickets de ese cliente
        const targetUrl = new URL("https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents");
        targetUrl.searchParams.set("clientId", clientId);

        // Opcional: Filtramos para que no traiga los cancelados si no te interesan
        // targetUrl.searchParams.set("status", "pending"); 

        const authHeader = req.headers.get('authorization');

        console.log(`[Proxy] Buscando historial para cliente: ${clientId}`);

        const apiResponse = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            }
        });

        if (!apiResponse.ok) {
            return NextResponse.json({ found: false }, { status: apiResponse.status });
        }

        const data = await apiResponse.json();
        const incidents = data.data || [];

        if (incidents.length > 0) {
            // 2. ORDENAMOS por fecha de creación (del más nuevo al más viejo)
            // Asumimos que la API devuelve un array, pero por seguridad lo ordenamos nosotros.
            incidents.sort((a: any, b: any) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            const lastIncident = incidents[0];

            console.log(`[Proxy] Última incidencia encontrada: ${lastIncident.id}`);

            // Devolvemos contexto para que la IA sepa de qué hablar
            return NextResponse.json({
                found: true,
                incidentId: lastIncident.id,
                title: lastIncident.title,
                status: lastIncident.status,
                description: lastIncident.description,
                scheduledDate: lastIncident.scheduledDate,
                scheduledTime: lastIncident.scheduledTime,
                address: lastIncident.location
            });
        } else {
            return NextResponse.json({ found: false });
        }

    } catch (error: any) {
        console.error("[Proxy] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}