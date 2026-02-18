import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import OpenAI from 'openai';
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware';

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit: max 3 analysis per minute per user (expensive operation)
        if (!checkRateLimit(`training-analysis:${user.uid}`, 3, 60_000)) {
            return NextResponse.json({ error: 'Too many requests. Wait a moment.' }, { status: 429 });
        }

        const body = await req.json();
        const { subworkspaceId, callCount = 20 } = body;

        if (!subworkspaceId) {
            return NextResponse.json({ error: 'Missing subworkspaceId' }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Database not available' }, { status: 500 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        // 1. Fetch subworkspace data (prompt + KB)
        const subDoc = await adminDb.collection('subworkspaces').doc(subworkspaceId).get();
        if (!subDoc.exists) {
            return NextResponse.json({ error: 'Subworkspace not found' }, { status: 404 });
        }

        const subData = subDoc.data()!;
        const agentPrompt = subData.active_prompt || subData.prompt_editable_text || '';
        const knowledgeBase = subData.knowledge_base || '';
        const agentId = subData.retell_agent_id;

        if (!agentId) {
            return NextResponse.json({ error: 'No agent linked to this subworkspace' }, { status: 400 });
        }

        // 2. Fetch last N calls for this agent
        const callsSnapshot = await adminDb.collection('calls')
            .where('agent_id', '==', agentId)
            .orderBy('start_timestamp', 'desc')
            .limit(Math.min(callCount, 50))
            .get();

        if (callsSnapshot.empty) {
            return NextResponse.json({ error: 'No calls found for this agent' }, { status: 404 });
        }

        // Build transcript summaries for each call
        const callSummaries = callsSnapshot.docs.map((doc, idx) => {
            const call = doc.data();
            const transcript = call.transcript_object || [];
            const transcriptText = transcript.map((t: any) => `${t.role.toUpperCase()}: ${t.content}`).join('\n');
            const errors = call.training_flags?.errors || [];
            const errorSummary = errors.length > 0
                ? `\nERRORES DETECTADOS: ${errors.map((e: any) => e.description).join('; ')}`
                : '';

            return `--- LLAMADA ${idx + 1} (${new Date(call.start_timestamp).toLocaleDateString('es-ES')}, duración: ${Math.round(call.duration || 0)}s) ---
${transcriptText}${errorSummary}`;
        }).join('\n\n');

        // 3. Send to reasoning model
        console.log(`[Training Analysis] Analyzing ${callsSnapshot.size} calls for subworkspace ${subworkspaceId}`);

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `Eres un consultor experto en optimización de agentes de IA telefónicos. Tu trabajo es analizar conversaciones reales, el prompt actual y la base de conocimiento, e identificar mejoras concretas.

Debes responder SOLO con un JSON válido con esta estructura:
{
  "summary": "Resumen general del rendimiento del agente (2-3 frases en español)",
  "overall_score": number 1-10,
  "prompt_suggestions": [
    {
      "type": "add" | "modify" | "remove",
      "section": "qué parte del prompt afecta",
      "current": "texto actual (si aplica)",
      "suggested": "texto sugerido",
      "reason": "por qué este cambio mejora el rendimiento"
    }
  ],
  "kb_suggestions": [
    {
      "type": "add" | "modify" | "remove",
      "topic": "tema afectado",
      "current": "contenido actual (si aplica)",
      "suggested": "contenido sugerido",
      "reason": "por qué este cambio es necesario"
    }
  ],
  "recurring_issues": [
    {
      "issue": "descripción del problema recurrente",
      "frequency": "en cuántas llamadas ocurre aproximadamente",
      "impact": "low" | "medium" | "high"
    }
  ]
}`;

        const userPrompt = `Analiza las siguientes ${callsSnapshot.size} conversaciones del agente y propón mejoras concretas al prompt y la base de conocimiento.

PROMPT ACTUAL DEL AGENTE:
${agentPrompt || '(Sin prompt configurado)'}

BASE DE CONOCIMIENTO ACTUAL:
${knowledgeBase || '(Sin base de conocimiento configurada)'}

CONVERSACIONES RECIENTES:
${callSummaries}

Identifica:
1. Errores recurrentes del agente
2. Información que falta en la KB
3. Instrucciones del prompt que no se siguen o son confusas
4. Oportunidades de mejora en el tono o estilo del agente
5. Propuestas de texto concreto para añadir/modificar en el prompt y KB`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'chatgpt-5.1',
            response_format: { type: 'json_object' }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        console.log(`[Training Analysis] Complete. Score: ${result.overall_score}, Prompt suggestions: ${result.prompt_suggestions?.length || 0}, KB suggestions: ${result.kb_suggestions?.length || 0}`);

        return NextResponse.json({
            success: true,
            analysis: result,
            callsAnalyzed: callsSnapshot.size,
        });

    } catch (error: any) {
        console.error('[Training Analysis] Error:', error);
        return NextResponse.json(
            { error: 'Analysis failed', details: error.message },
            { status: 500 }
        );
    }
}
