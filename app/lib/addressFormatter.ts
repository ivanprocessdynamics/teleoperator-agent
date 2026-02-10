
export function formatAddressForSpeech(address: string): string {
    if (!address) return "";

    let normalized = address;

    // 1. Expandir abreviaturas comunes de calle
    normalized = normalized.replace(/\bC\/\s*/gi, "Calle ");
    normalized = normalized.replace(/\bAv\.?\s*/gi, "Avenida ");
    normalized = normalized.replace(/\bPso\.?\s*/gi, "Paseo ");
    normalized = normalized.replace(/\bPza\.?\s*/gi, "Plaza ");
    normalized = normalized.replace(/\bCrta\.?\s*/gi, "Carretera ");
    normalized = normalized.replace(/\bPtda\.?\s*/gi, "Partida ");

    // 2. Expandir números ordinales (Pisos y Puertas comunes)
    // Mapeo básico 1-10 para º (masculino/pisos) y ª (femenino/puertas)

    const mapMasculine: Record<string, string> = {
        "1": "primero", "2": "segundo", "3": "tercero", "4": "cuarto", "5": "quinto",
        "6": "sexto", "7": "séptimo", "8": "octavo", "9": "noveno", "10": "décimo"
    };

    const mapFeminine: Record<string, string> = {
        "1": "primera", "2": "segunda", "3": "tercera", "4": "cuarta", "5": "quinta",
        "6": "sexta", "7": "séptima", "8": "octava", "9": "novena", "10": "décima"
    };

    // Reemplazo de º (ej: 4º -> cuarto)
    normalized = normalized.replace(/\b(\d+)º/g, (match, number) => {
        return mapMasculine[number] ? `${mapMasculine[number]} ` : match; // Dejar igual si no está en mapa (ej: 25º)
    });

    // Reemplazo de ª (ej: 3ª -> tercera)
    normalized = normalized.replace(/\b(\d+)ª/g, (match, number) => {
        // A veces "1ª" en dirección puede ser "primera planta" o "primera puerta"
        return mapFeminine[number] ? `${mapFeminine[number]} ` : match;
    });

    // 3. Limpiar espacios extra
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
}
