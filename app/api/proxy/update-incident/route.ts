import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...fieldsToUpdate } = body;

        // 1. Validaciones básicas
        if (!id) {
            return NextResponse.json(
                { error: "Missing 'id' parameter in request body" },
                { status: 400 }
            );
        }

        const authHeader = req.headers.get('authorization');
        const targetUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents/${id}`;

        // --- LÓGICA DE CONCATENACIÓN (APPEND) ---

        // Si la petición incluye una descripción nueva, tenemos que leer la antigua primero
        if (fieldsToUpdate.description) {
            console.log(`[Proxy] Fetching current description for Incident ${id}...`);

            // A. Hacemos GET para leer lo que hay ahora
            const currentDataResponse = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authHeader ? { 'Authorization': authHeader } : {})
                }
            });

            if (currentDataResponse.ok) {
                const currentData = await currentDataResponse.json();
                const oldDescription = currentData.description || "";
                const newNote = fieldsToUpdate.description;

                // B. Combinamos: Lo viejo + Salto de línea + ACTUALIZACIÓN + Lo nuevo
                // Usamos '\n' para que quede ordenado visualmente
                fieldsToUpdate.description = `${oldDescription}\n\nACTUALIZACIÓN: ${newNote}`;

                console.log(`[Proxy] Description appended. Length: ${fieldsToUpdate.description.length}`);
            } else {
                console.warn(`[Proxy] Could not fetch current incident data. Status: ${currentDataResponse.status}`);
                // Si falla la lectura, decidimos si sobrescribimos o paramos. 
                // En este caso, dejamos que siga y sobrescribirá (o puedes lanzar error).
            }
        }

        // ----------------------------------------

        console.log(`[Proxy] Patching Incident ${id}...`);

        // 2. Hacemos el PATCH con los datos ya combinados
        const apiResponse = await fetch(targetUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify(fieldsToUpdate)
        });

        // 3. Procesamos respuesta
        const contentType = apiResponse.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await apiResponse.json();
        } else {
            const text = await apiResponse.text();
            try { data = JSON.parse(text); } catch { data = { message: text }; }
        }

        return NextResponse.json(data, { status: apiResponse.status });

    } catch (error: any) {
        console.error("[Proxy] Error:", error);
        return NextResponse.json(
            { error: "Internal Proxy Error", details: error.message },
            { status: 500 }
        );
    }
}