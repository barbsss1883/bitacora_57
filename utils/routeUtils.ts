export type CoordenadaLngLat = [number, number];

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const parseRutaPuntos = (rutaGeojson: unknown): any[] => {
  if (Array.isArray(rutaGeojson)) return rutaGeojson;
  if (typeof rutaGeojson === 'string' && rutaGeojson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rutaGeojson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

export const extraerCoordenadaLngLat = (punto: any): CoordenadaLngLat | null => {
  if (Array.isArray(punto) && punto.length >= 2) {
    const lng = toNumberOrNull(punto[0]);
    const lat = toNumberOrNull(punto[1]);
    if (lng !== null && lat !== null) return [lng, lat];
    return null;
  }

  if (!punto || typeof punto !== 'object') return null;

  const lat = toNumberOrNull(punto.latitude ?? punto.latitud ?? punto.lat);
  const lng = toNumberOrNull(punto.longitude ?? punto.longitud ?? punto.lng);
  if (lng === null || lat === null) return null;
  return [lng, lat];
};

export const normalizarRutaCoordenadas = (rutaGeojson: unknown): CoordenadaLngLat[] => {
  return parseRutaPuntos(rutaGeojson)
    .map((punto) => extraerCoordenadaLngLat(punto))
    .filter((coord): coord is CoordenadaLngLat => coord !== null);
};

export const extraerFechaPuntoISO = (punto: any): string => {
  const fechaCruda = punto?.timestamp ?? punto?.fecha ?? null;
  if (!fechaCruda) return new Date().toISOString();

  const fecha = new Date(fechaCruda);
  if (Number.isNaN(fecha.getTime())) return new Date().toISOString();
  return fecha.toISOString();
};
