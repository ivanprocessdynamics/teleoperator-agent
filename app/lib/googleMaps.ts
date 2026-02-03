
export async function validateAddress(rawAddress: string): Promise<string> {
    const apiKey = process.env.GOOGLE_MAPS_KEY;

    // Si no hay key, devolvemos la original sin tocar (Fallback)
    if (!apiKey) {
        console.warn("Falta GOOGLE_MAPS_KEY en variables de entorno");
        return rawAddress;
    }

    try {
        // Añadimos "Spain" o tu región por defecto para ayudar a Google
        const query = encodeURIComponent(`${rawAddress}, España`);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}&language=es`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            // Devolvemos la dirección formateada oficial de Google
            const formatted = data.results[0].formatted_address;
            console.log(`[Google Maps] Corrección: '${rawAddress}' -> '${formatted}'`);
            return formatted;
        } else {
            console.log(`[Google Maps] No se encontró resultado para: ${rawAddress}`);
            return rawAddress; // Si falla, devolvemos la original
        }
    } catch (error) {
        console.error("[Google Maps] Error de conexión:", error);
        return rawAddress; // Si explota, devolvemos la original
    }
}
