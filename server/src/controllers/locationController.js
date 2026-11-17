/**
 * Location Geocoding & Reverse Geocoding Controller
 * Proxies geocoding requests safely to Nominatim / OpenStreetMap
 * without exposing external tokens or violating CSP / CORS policies.
 */

// Popular presets for instant offline/fallback resolution
const LOCAL_PRESETS = [
  {
    name: 'Atigre, Kolhapur',
    displayName: 'Atigre, Kolhapur District, Maharashtra, 416118, India',
    lat: 16.7410,
    lng: 74.3720
  },
  {
    name: 'Vijayawada Bus Stand',
    displayName: 'Pandit Nehru Bus Station, Vijayawada, Krishna, Andhra Pradesh, 520002, India',
    lat: 16.5097,
    lng: 80.6174
  },
  {
    name: 'Vijayawada, TDP Office / Mandapam',
    displayName: 'TDP State Office, Mangalagiri / Vijayawada, Guntur, Andhra Pradesh, 522503, India',
    lat: 16.4350,
    lng: 80.5670
  },
  {
    name: 'Hatkanangale',
    displayName: 'Hatkanangale, Kolhapur, Maharashtra, India',
    lat: 16.7445,
    lng: 74.4442
  },
  {
    name: 'Shiroli MIDC',
    displayName: 'Shiroli MIDC, Kolhapur, Maharashtra, India',
    lat: 16.7482,
    lng: 74.3015
  },
  {
    name: 'Ichalkaranji',
    displayName: 'Ichalkaranji, Kolhapur, Maharashtra, India',
    lat: 16.6960,
    lng: 74.4620
  },
  {
    name: 'Kolhapur Central',
    displayName: 'Kolhapur Central Railway Station, Kolhapur, Maharashtra, India',
    lat: 16.7050,
    lng: 74.2430
  },
  {
    name: 'Bandra Kurla Complex (BKC)',
    displayName: 'Bandra Kurla Complex, Mumbai, Maharashtra, 400051, India',
    lat: 19.0657,
    lng: 72.8687
  },
  {
    name: 'Hitec City, Hyderabad',
    displayName: 'Hitec City, Madhapur, Hyderabad, Telangana, 500081, India',
    lat: 17.4474,
    lng: 78.3762
  },
  {
    name: 'Koramangala, Bengaluru',
    displayName: 'Koramangala, Bengaluru, Karnataka, 560034, India',
    lat: 12.9352,
    lng: 77.6245
  }
];

export const geocodeLocation = async (req, res, next) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        results: []
      });
    }

    // Check local preset matches first
    const qLower = query.toLowerCase();
    const presetMatches = LOCAL_PRESETS.filter((p) =>
      p.name.toLowerCase().includes(qLower) || p.displayName.toLowerCase().includes(qLower)
    );

    // Call Nominatim with User-Agent header (OSM Usage Policy compliant)
    let remoteResults = [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WorkMatch-Attendance-System/1.0 (contact: info@workmatch.app)',
          'Accept-Language': 'en'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          remoteResults = data.map((item) => ({
            id: String(item.place_id || `${item.lat},${item.lon}`),
            name: item.name || item.display_name?.split(',')[0] || query,
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type || item.class || 'location'
          }));
        }
      }
    } catch (fetchErr) {
      // Graceful fallback to presets or empty on network timeout/error
      console.warn('[Geocoding] External fetch failed or timed out:', fetchErr.message);
    }

    // Merge preset matches with remote results (deduplicating by close proximity)
    const combined = [...presetMatches.map(p => ({
      id: `preset-${p.name}`,
      name: p.name,
      displayName: p.displayName,
      lat: p.lat,
      lng: p.lng,
      type: 'preset'
    })), ...remoteResults];

    // Deduplicate
    const unique = [];
    const seen = new Set();
    for (const item of combined) {
      const key = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    res.status(200).json({
      success: true,
      results: unique.slice(0, 8)
    });
  } catch (error) {
    next(error);
  }
};

export const reverseGeocode = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.'
      });
    }

    // Check if close to a preset
    for (const p of LOCAL_PRESETS) {
      const dLat = Math.abs(p.lat - lat);
      const dLng = Math.abs(p.lng - lng);
      if (dLat < 0.005 && dLng < 0.005) {
        return res.status(200).json({
          success: true,
          locationName: p.displayName,
          lat: p.lat,
          lng: p.lng
        });
      }
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WorkMatch-Attendance-System/1.0 (contact: info@workmatch.app)',
          'Accept-Language': 'en'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          return res.status(200).json({
            success: true,
            locationName: data.display_name,
            lat,
            lng
          });
        }
      }
    } catch {
      // fallback
    }

    // Default formatted string if external lookup is unavailable
    res.status(200).json({
      success: true,
      locationName: `Location at ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
      lat,
      lng
    });
  } catch (error) {
    next(error);
  }
};
