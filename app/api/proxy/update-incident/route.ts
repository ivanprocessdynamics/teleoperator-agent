import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, priority, status } = body;

        // 3. Validate 'id' exists
        if (!id) {
            return NextResponse.json(
                { error: "Missing 'id' parameter in request body" },
                { status: 400 }
            );
        }

        // 4. Read Authorization header
        const authHeader = req.headers.get('authorization');

        // 5. Construct target URL
        const targetUrl = `https://us-central1-satflow-d3744.cloudfunctions.net/api/v1/incidents/${id}`;

        console.log(`[Proxy] Forwarding PATCH to: ${targetUrl}`);

        // 6. Make PATCH request
        const apiResponse = await fetch(targetUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                // Pass Authorization if present
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify({
                priority,
                status
            })
        });

        // 7. Return exact response
        // Parse JSON if possible, otherwise text
        const contentType = apiResponse.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await apiResponse.json();
        } else {
            // Fallback for non-JSON answers
            const text = await apiResponse.text();
            try {
                data = JSON.parse(text);
            } catch {
                data = { message: text };
            }
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
