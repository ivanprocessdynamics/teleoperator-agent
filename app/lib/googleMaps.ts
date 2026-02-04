
export async function validateAddress(rawAddress: string): Promise<{ address: string, debug: any }> {
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    const debugInfo: any = { step: "start", raw: rawAddress, hasKey: !!apiKey };

    // Si no hay key, devolvemos la original sin tocar (Fallback)
    if (!apiKey) {
        console.warn("Falta GOOGLE_MAPS_KEY en variables de entorno");
        debugInfo.error = "MISSING_API_KEY";
        return { address: rawAddress, debug: debugInfo };
    }

    try {
        // LIMPIEZA
        // 1. Quitar la palabra "numero" o "nº" para no confundir a Gugle
        let cleanAddress = rawAddress.replace(/\b(numero|número|num|nº)\b/gi, "").trim();

        // 2. Quitamos espacios dobles
        cleanAddress = cleanAddress.replace(/\s+/g, " ");

        debugInfo.sanitized = cleanAddress;

        // Longitud mínima tras limpieza de 5
        if (cleanAddress.length < 5) {
            console.warn(`[Google Maps] Dirección demasiado corta tras limpieza: '${cleanAddress}'. Usando original.`);
            debugInfo.error = "TOO_SHORT_AFTER_CLEANAL";
            return { address: rawAddress, debug: debugInfo };
        }

        // 3. Añadimos contexto forzado si no está presente
        const query = encodeURIComponent(`${cleanAddress}, España`);

        console.log(`[Google Maps] Buscando: ${cleanAddress}`);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&language=es`;

        debugInfo.url = url.replace(apiKey, "HIDDEN"); // Ocultar la key en logs

        const response = await fetch(url);
        const data = await response.json();

        debugInfo.googleStatus = data.status;

        if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            const formatted = result.formatted_address;

            // PROTECCIÓN: Si Google devuelve solo "España" (o país generico) y nosotros enviamos algo más largo,
            // significa que no encontró la calle y hizo fallback al país.
            const isGenericCountry = result.types.includes('country') && result.types.length === 2 && result.types.includes('political');

            // Check if result is just a City/Locality OR Postal Code
            const isLocality = result.types.includes('locality') ||
                result.types.includes('administrative_area_level_2') ||
                result.types.includes('postal_code'); // <--- Añadido postal_code

            const hasStreet = result.types.includes('street_address') ||
                result.types.includes('route') ||
                result.types.includes('premise') ||
                result.types.includes('subpremise');

            if (isGenericCountry || formatted === "Spain" || formatted === "España" || (isLocality && !hasStreet && cleanAddress.length > 15)) {
                console.warn(`[Google Maps] Resultado demasiado genérico ('${formatted}') para input detallado. Usando original saneado.`);
                debugInfo.error = "GENERIC_FALLBACK_REJECTED";
                return { address: cleanAddress, debug: debugInfo };
            }

            console.log(`[Google Maps] Corrección: '${rawAddress}' -> '${formatted}'`);
            debugInfo.success = true;
            return { address: formatted, debug: debugInfo };
        } else {
            console.log(`[Google Maps] No se encontró resultado para: ${rawAddress}`);
            debugInfo.error = "ZERO_RESULTS_OR_OTHER";
            return { address: rawAddress, debug: debugInfo };
        }
    } catch (error: any) {
        console.error("[Google Maps] Error de conexión:", error);
        debugInfo.error = "EXCEPTION: " + error.message;
        return { address: rawAddress, debug: debugInfo };
    }
}
