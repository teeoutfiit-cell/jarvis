// Google Places API (New) — Text Search.
// Field mask deliberadamente restrito ao tier "Enterprise": nome, endereço,
// telefone, site, status e rating. NÃO inclua "reviews"/"editorialSummary"/
// campos de atmosfera — isso empurra o request pro tier mais caro
// ("Enterprise + Atmosphere") sem necessidade nenhuma pra qualificar leads.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount'
].join(',');

export async function searchPlaces({ apiKey, query, maxResults }) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      maxResultCount: Math.min(maxResults || 20, 20)
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('places_error_' + res.status + ': ' + t.slice(0, 300));
  }

  const data = await res.json();
  return (data.places || [])
    .filter((p) => p.businessStatus === 'OPERATIONAL' && (p.internationalPhoneNumber || p.nationalPhoneNumber))
    .map((p) => ({
      placeId: p.id,
      nome: (p.displayName && p.displayName.text) || '',
      endereco: p.formattedAddress || '',
      telefone: p.internationalPhoneNumber || p.nationalPhoneNumber || '',
      site: p.websiteUri || '',
      rating: typeof p.rating === 'number' ? p.rating : null,
      avaliacoes: typeof p.userRatingCount === 'number' ? p.userRatingCount : null
    }));
}
