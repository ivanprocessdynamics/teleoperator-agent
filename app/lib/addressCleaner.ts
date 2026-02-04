
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function cleanAddressWithAI(dirtyAddress: string): Promise<string> {
    // Safe check if key is missing to avoid crashing
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[AI Cleaner] Missing OPENAI_API_KEY, skipping AI cleaning.");
        return dirtyAddress;
    }

    console.log(`[AI Cleaner] Limpiando: "${dirtyAddress}"`);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en direcciones de España y corrección fonética.
          Tu tarea es corregir transcripciones de voz erróneas de direcciones de forma conservadora.
          
          Instrucciones:
          1. Corrige nombres propios mal transcritos (ej: "Dantoni" -> "d'Antoni", "au lestia" -> "Aulèsties").
          2. Detecta calles en Cataluña/España (Carrer, Avinguda, Calle...).
          3. Convierte texto a números ("cinco" -> "5").
          4. IMPORTANTE: Mantén el piso y puerta si existen, pero formateados (ej: "tercero primera" -> "3º 1ª").
          5. Si la dirección parece ya correcta, devuélvela tal cual.
          6. DEVUELVE SOLO LA DIRECCIÓN CORREGIDA. Nada más.`
                },
                {
                    role: "user",
                    content: `Corrige esta dirección: ${dirtyAddress}`
                }
            ],
            temperature: 0.1, // Creatividad baja para ser preciso
            max_tokens: 100,
        });

        const cleaned = response.choices[0].message.content?.trim() || dirtyAddress;
        console.log(`[AI Cleaner] Resultado: "${cleaned}"`);
        return cleaned;

    } catch (error) {
        console.error("[AI Cleaner] Error:", error);
        return dirtyAddress; // Si falla la IA, devolvemos la original
    }
}
