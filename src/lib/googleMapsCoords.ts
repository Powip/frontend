/**
 * Extrae latitud/longitud de un link de Google Maps.
 * Soporta el pin exacto ("!3d…!4d…"), el centro del mapa ("@lat,lng,zoom")
 * y "?q=lat,lng". Los links cortos (maps.app.goo.gl) no traen coordenadas: devuelve null.
 */
export function extractLatLngFromGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // pin exacto en links "place/.../data="
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // centro del mapa "@lat,lng,zoom"
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // link corto "?q=lat,lng"
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return null;
}
