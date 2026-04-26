export type CoordenadaLngLat = [number, number];

// Tipo de entrada para puntos GPS — acepta tanto arrays [lng,lat] como objetos
type PuntoRuta = [number, number] | {
  latitude?: number; latitud?: number; lat?: number;
  longitude?: number; longitud?: number; lng?: number;
  timestamp?: number | string;
  fecha?: string;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const parseRutaPuntos = (rutaGeojson: unknown): PuntoRuta[] => {
  if (Array.isArray(rutaGeojson)) return rutaGeojson as PuntoRuta[];
  if (typeof rutaGeojson === 'string' && rutaGeojson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rutaGeojson);
      return Array.isArray(parsed) ? (parsed as PuntoRuta[]) : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

export const extraerCoordenadaLngLat = (punto: PuntoRuta): CoordenadaLngLat | null => {
  if (Array.isArray(punto) && punto.length >= 2) {
    const lng = toNumberOrNull(punto[0]);
    const lat = toNumberOrNull(punto[1]);
    if (lng !== null && lat !== null) return [lng, lat];
    return null;
  }

  if (!punto || typeof punto !== 'object') return null;

  const p = punto as Exclude<PuntoRuta, [number, number]>;
  const lat = toNumberOrNull(p.latitude ?? p.latitud ?? p.lat);
  const lng = toNumberOrNull(p.longitude ?? p.longitud ?? p.lng);
  if (lng === null || lat === null) return null;
  return [lng, lat];
};

export const normalizarRutaCoordenadas = (rutaGeojson: unknown): CoordenadaLngLat[] => {
  return parseRutaPuntos(rutaGeojson)
    .map((punto) => extraerCoordenadaLngLat(punto))
    .filter((coord): coord is CoordenadaLngLat => coord !== null);
};

export const extraerFechaPuntoISO = (punto: PuntoRuta): string => {
  if (Array.isArray(punto)) return new Date().toISOString();
  const p = punto as Exclude<PuntoRuta, [number, number]>;
  const fechaCruda = p.timestamp ?? p.fecha ?? null;
  if (!fechaCruda) return new Date().toISOString();
  const fecha = new Date(fechaCruda as string | number);
  if (Number.isNaN(fecha.getTime())) return new Date().toISOString();
  return fecha.toISOString();
};
