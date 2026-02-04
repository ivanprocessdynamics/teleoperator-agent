
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper para asegurar conversión de números comunes (Español y Catalán)
function textToDigits(text: string): string {
    const map: { [key: string]: string } = {
        "uno": "1", "una": "1", "un": "1", "primero": "1º", "primera": "1ª", "primer": "1r",
        "dos": "2", "segundo": "2º", "segunda": "2ª", "segon": "2n", "segona": "2a",
        "tres": "3", "tercero": "3º", "tercera": "3ª", "tercer": "3r",
        "cuatro": "4", "quatre": "4", "cuarto": "4º", "cuarta": "4ª", "quart": "4t",
        "cinco": "5", "cinc": "5", "quinto": "5º", "quinta": "5ª", "cinque": "5è",
        "seis": "6", "sis": "6", "sexto": "6º", "sexta": "6ª", "sise": "6è",
        "siete": "7", "set": "7", "septimo": "7º", "septima": "7ª", "sete": "7è",
        "ocho": "8", "vuit": "8", "octavo": "8º", "octava": "8ª", "vuite": "8è",
        "nueve": "9", "nou": "9", "noveno": "9º", "novena": "9ª", "nove": "9è",
        "diez": "10", "deu": "10", "decimo": "10º", "decima": "10ª", "dese": "10è",
        "once": "11", "onze": "11",
        "doce": "12", "dotze": "12",
        "trece": "13", "tretze": "13",
        "veinte": "20", "vint": "20",
        "treinta": "30", "trenta": "30"
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
            model: "gpt-4o", // Volvemos a GPT-4o para evitar alucinaciones ("Rovira i Virgili")
            messages: [
                {
                    role: "system",
                    content: `Eres un experto corrector fonético de direcciones en España y Cataluña.
          Instrucciones:
          1. PRIORIDAD ABSOLUTA: Fidelidad Fonética. Transcribe lo que SUENA, no inventes calles famosas si no coinciden fonéticamente.
          2. ESTRUCTURA: Calle Nombre, Número, Piso/Puerta, CP Población.
          3. NÚMEROS: Convierte TODO texto numérico a dígitos.
          4. Si dudas entre una calle famosa y una transcripción literal que encaja fonéticamente, elige la literal.`
                },
                {
                    role: "user",
                    content: `Corrige e interpreta: ${dirtyAddress}`
                }
            ],
            temperature: 0.1,
            max_tokens: 150,
        });

        let cleaned = response.choices[0].message.content?.trim() || dirtyAddress;

        // POST-PROCESADO: Aseguramos los números con el helper (Español + Catalán)
        cleaned = textToDigits(cleaned);

        console.log(`[AI Cleaner] Resultado: "${cleaned}"`);
        return cleaned;

    } catch (error: any) {
        console.error(`[AI Cleaner] Error:`, error.message);
        return textToDigits(dirtyAddress);
    }
}
