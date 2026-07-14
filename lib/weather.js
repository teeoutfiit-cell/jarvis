export const WMO = {
  0: 'céu limpo', 1: 'poucas nuvens', 2: 'parcialmente nublado', 3: 'nublado',
  45: 'neblina', 48: 'neblina', 51: 'garoa leve', 61: 'chuva leve', 63: 'chuva',
  65: 'chuva forte', 71: 'neve leve', 80: 'pancadas de chuva', 95: 'tempestade'
};

export async function ensureWeatherCoords(weather) {
  if (!weather || !weather.city) return null;
  if (weather.lat && weather.lon) return weather;
  try {
    const res = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(weather.city) + '&count=1&language=pt',
      { cache: 'no-store' }
    );
    const d = await res.json();
    if (d.results && d.results[0]) {
      weather.lat = d.results[0].latitude;
      weather.lon = d.results[0].longitude;
      return weather;
    }
  } catch (e) {}
  return null;
}

export async function getWeatherToday(weather) {
  const w = await ensureWeatherCoords(weather);
  if (!w || !w.lat) return null;
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + w.lat + '&longitude=' + w.lon +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto',
      { cache: 'no-store' }
    );
    const d = await res.json();
    if (d.daily) {
      return {
        max: Math.round(d.daily.temperature_2m_max[0]),
        min: Math.round(d.daily.temperature_2m_min[0]),
        code: d.daily.weather_code[0]
      };
    }
  } catch (e) {}
  return null;
}
