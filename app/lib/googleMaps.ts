
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
        // Añadimos "Spain" o tu región por defecto para ayudar a Google
        const query = encodeURIComponent(`${rawAddress}, España`);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&language=es`;

        debugInfo.url = url.replace(apiKey, "HIDDEN"); // Hide key in logs

        const response = await fetch(url);
        const data = await response.json();

        debugInfo.googleStatus = data.status;

        if (data.status === 'OK' && data.results.length > 0) {
            // Devolvemos la dirección formateada oficial de Google
            const formatted = data.results[0].formatted_address;
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
