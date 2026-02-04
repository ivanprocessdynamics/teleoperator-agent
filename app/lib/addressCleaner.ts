
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper para asegurar conversión de números comunes
function textToDigits(text: string): string {
    const map: { [key: string]: string } = {
        "uno": "1", "una": "1", "primero": "1º", "primera": "1ª",
        "dos": "2", "segundo": "2º", "segunda": "2ª",
        "tres": "3", "tercero": "3º", "tercera": "3ª",
        "cuatro": "4", "cuarto": "4º", "cuarta": "4ª",
        "cinco": "5", "quinto": "5º", "quinta": "5ª",
        "seis": "6", "sexto": "6º", "sexta": "6ª",
        "siete": "7", "septimo": "7º", "septima": "7ª",
        "ocho": "8", "octavo": "8º", "octava": "8ª",
        "nueve": "9", "noveno": "9º", "novena": "9ª",
        "diez": "10", "decimo": "10º", "decima": "10ª",
        "once": "11", "doce": "12", "trece": "13", "catorce": "14", "quince": "15",
        "veinte": "20", "treinta": "30", "cuarenta": "40"
    };

    let processed = text;
    // Reemplazo case-insensitive de palabras completas
    Object.keys(map).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        processed = processed.replace(regex, map[key]);
    });
    return processed;
}

export async function cleanAddressWithAI(dirtyAddress: string): Promise<string> {
    // Safe check if key is missing to avoid crashing
    if (!process.env.OPENAI_API_KEY) {
        console.warn("[AI Cleaner] Missing OPENAI_API_KEY, skipping AI cleaning.");
        return textToDigits(dirtyAddress); // Al menos aplicamos la limpieza manual
    }

    console.log(`[AI Cleaner] Limpiando: "${dirtyAddress}"`);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en direcciones de España.
          Tu tarea es corregir transcripciones de voz erróneas.
          
          Instrucciones:
          1. Corrige nombres propios con conocimiento fonético (ej: "au lestia" -> "Aulèsties").
          2. ESTRUCTURA CRÍTICA: "Calle Nombre, Número, Piso/Puerta, CP Población".
          3. IMPORTANTE: "Número cinco" es el Número de Calle "5". NO es el piso.
          4. IMPORTANTE: "Tercero primera" es el Piso "3º 1ª".
          5. EJEMPLO: Entrada "calle falsa numero cinco tercero primera" -> Salida "Calle Falsa, 5, 3º 1ª, CP..."
          6. Devuelve SOLO la dirección final formateada.`
                },
                {
                    role: "user",
                    content: `Corrige e interpreta: ${dirtyAddress}`
                }
            ],
            temperature: 0.1,
            max_tokens: 100,
        });

        let cleaned = response.choices[0].message.content?.trim() || dirtyAddress;

        // POST-PROCESADO: Aseguramos los números con el helper (doble seguridad)
        cleaned = textToDigits(cleaned);

        console.log(`[AI Cleaner] Resultado: "${cleaned}"`);
        return cleaned;

    } catch (error: any) {
        console.error(`[AI Cleaner] Error con modelo principal (${process.env.OPENAI_MODEL || "gpt-5.1"}):`, error.message);

        // Fallback a modelo conocido si falla el puntero
        try {
            console.log("[AI Cleaner] Intentando fallback a gpt-4o...");
            const fallbackResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "Corrige dirección España. Fonética y formato. Devuelve SOLO dirección."
                    },
                    {
                        role: "user",
                        content: dirtyAddress
                    }
                ]
            });
            let cleaned = fallbackResponse.choices[0].message.content?.trim() || dirtyAddress;
            // Aplicar también al fallback
            cleaned = textToDigits(cleaned);
            console.log(`[AI Cleaner] Resultado (Fallback): "${cleaned}"`);
            return cleaned;
        } catch (fallbackError) {
            console.error("[AI Cleaner] Falló también el fallback:", fallbackError);
            return textToDigits(dirtyAddress);
        }
    }
}
