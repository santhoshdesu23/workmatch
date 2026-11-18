import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, CheckCircle2, AlertCircle, Loader2, Focus } from 'lucide-react';
import api from '../../api/client';
import { Button } from './Button';

interface LocationResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
}

interface LocationPickerProps {
  initialLocationName?: string;
  initialCoordinates?: [number, number] | null; // [lng, lat]
  onLocationChange: (locationName: string, coordinates: [number, number]) => void;
  required?: boolean;
}

// Custom icon creator
const createVenueIcon = () =>
  L.divIcon({
    className: 'custom-venue-marker',
    html: `
      <div style="
        background-color: #059669;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.35);
        font-size: 18px;
        cursor: grab;
      ">📍</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 32]
  });

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLocationName = '',
  initialCoordinates = null,
  onLocationChange,
  required = true
}) => {
  const [query, setQuery] = useState(initialLocationName);
  const [confirmedAddress, setConfirmedAddress] = useState(initialLocationName);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(initialCoordinates); // [lng, lat]
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const searchTimeoutRef = useRef<any>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Update map view, marker, and 200m geofence circle
  const updateMapPosition = useCallback((lat: number, lng: number, recenter = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (recenter) {
      map.setView([lat, lng], 16);
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], {
        icon: createVenueIcon(),
        draggable: true
      }).addTo(map);

      marker.on('dragend', (e: any) => {
        const newLatLng = e.target.getLatLng();
        handleManualPinAdjustment(newLatLng.lat, newLatLng.lng);
      });
      markerRef.current = marker;
    }

    // 200-metre attendance geofence circle
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
    } else {
      const circle = L.circle([lat, lng], {
        radius: 200,
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '4, 6'
      }).addTo(map);
      circleRef.current = circle;
    }

    map.invalidateSize();
  }, []);

  // Sync initial values from props (e.g., job editing or restored draft)
  useEffect(() => {
    if (initialLocationName && initialLocationName !== query) {
      setQuery(initialLocationName);
      setConfirmedAddress(initialLocationName);
    }
    if (
      initialCoordinates &&
      initialCoordinates.length === 2 &&
      (!coordinates || coordinates[0] !== initialCoordinates[0] || coordinates[1] !== initialCoordinates[1])
    ) {
      setCoordinates(initialCoordinates);
      updateMapPosition(initialCoordinates[1], initialCoordinates[0], true);
    }
  }, [initialLocationName, initialCoordinates, updateMapPosition]);

  // Handle manual map pin drag or click
  const handleManualPinAdjustment = async (lat: number, lng: number) => {
    const coords: [number, number] = [lng, lat];
    setCoordinates(coords);
    updateMapPosition(lat, lng, false);

    setIsReverseGeocoding(true);
    try {
      const res = await api.get(`/location/reverse?lat=${lat}&lng=${lng}`);
      const addr = res.data?.locationName || `Location near ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
      setQuery(addr);
      setConfirmedAddress(addr);
      onLocationChange(addr, coords);
    } catch {
      const fallback = `Pinned Location (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E)`;
      setQuery(fallback);
      setConfirmedAddress(fallback);
      onLocationChange(fallback, coords);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Sanjay Ghodawat / Kolhapur area as smart default if no coordinates yet
    const defaultLat = coordinates && coordinates.length === 2 ? coordinates[1] : 16.74186;
    const defaultLng = coordinates && coordinates.length === 2 ? coordinates[0] : 74.38193;

    // Ensure clean container
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true
    }).setView([defaultLat, defaultLng], coordinates ? 16 : 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Click anywhere on map to drop / reposition pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      handleManualPinAdjustment(e.latlng.lat, e.latlng.lng);
    });

    // Create marker
    const marker = L.marker([defaultLat, defaultLng], {
      icon: createVenueIcon(),
      draggable: true
    }).addTo(map);

    marker.on('dragend', (e: any) => {
      const newLatLng = e.target.getLatLng();
      handleManualPinAdjustment(newLatLng.lat, newLatLng.lng);
    });
    markerRef.current = marker;

    // Create 200m circle
    const circle = L.circle([defaultLat, defaultLng], {
      radius: 200,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.18,
      weight: 2,
      dashArray: '4, 6'
    }).addTo(map);
    circleRef.current = circle;

    mapInstanceRef.current = map;

    // Force tile recalculation once DOM settles
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Handle location search with debounce
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/location/geocode?q=${encodeURIComponent(text.trim())}`);
        if (res.data?.success && Array.isArray(res.data.results)) {
          setSuggestions(res.data.results);
          setShowDropdown(res.data.results.length > 0);
        }
      } catch (err) {
        console.warn('Geocoding query error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Select a suggestion
  const handleSelectSuggestion = (item: LocationResult) => {
    const coords: [number, number] = [item.lng, item.lat];
    setCoordinates(coords);
    setQuery(item.displayName);
    setConfirmedAddress(item.displayName);
    setShowDropdown(false);
    onLocationChange(item.displayName, coords);
    updateMapPosition(item.lat, item.lng, true);
  };

  // Use browser GPS
  const handleUseBrowserGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const coords: [number, number] = [lng, lat];
        setCoordinates(coords);

        try {
          setIsReverseGeocoding(true);
          const res = await api.get(`/location/reverse?lat=${lat}&lng=${lng}`);
          const addr = res.data?.locationName || `Location near ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
          setQuery(addr);
          setConfirmedAddress(addr);
          onLocationChange(addr, coords);
        } catch {
          const fallback = `Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
          setQuery(fallback);
          setConfirmedAddress(fallback);
          onLocationChange(fallback, coords);
        } finally {
          setIsLocating(false);
          setIsReverseGeocoding(false);
          updateMapPosition(lat, lng, true);
        }
      },
      (err) => {
        setIsLocating(false);
        alert(`Could not acquire GPS: ${err.message}. You can manually search or pin on the map.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Recenter button
  const handleRecenterPin = () => {
    if (coordinates && coordinates.length === 2 && mapInstanceRef.current) {
      mapInstanceRef.current.setView([coordinates[1], coordinates[0]], 16);
      mapInstanceRef.current.invalidateSize();
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input & GPS Button */}
      <div ref={searchWrapperRef} className="relative z-20">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Shift Location & GPS Reference Point {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              required={required}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              placeholder="Type landmark, street, area, e.g. Near Bus Stand, Vijayawada or Atigre Kolhapur"
              className="w-full pl-9 pr-8 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-3 w-4 h-4 text-slate-400 animate-spin" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseBrowserGPS}
            isLoading={isLocating}
            leftIcon={<Navigation className="w-3.5 h-3.5" />}
          >
            My GPS
          </Button>
        </div>

        {/* Suggestions Dropdown (high z-index to stay above Leaflet controls) */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-[1001] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 hover:text-emerald-900 border-b border-slate-100 last:border-0 flex items-start gap-2 transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">{item.name}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{item.displayName}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Map Preview */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Click map or drag the pin to adjust exact attendance location</span>
          </div>
          <div className="flex items-center gap-2">
            {coordinates && (
              <button
                type="button"
                onClick={handleRecenterPin}
                className="text-slate-600 hover:text-emerald-700 flex items-center gap-1 text-[10px] font-medium bg-white px-2 py-0.5 rounded border border-slate-200 hover:border-emerald-300 transition-colors"
                title="Recenter view on pin"
              >
                <Focus className="w-3 h-3 text-emerald-600" />
                Recenter
              </button>
            )}
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              200m Attendance Radius
            </span>
          </div>
        </div>

        {/* Map Canvas with guaranteed height */}
        <div
          ref={mapContainerRef}
          style={{ height: '320px', minHeight: '320px', width: '100%' }}
          className="relative w-full z-0 bg-slate-100"
        />
      </div>

      {/* Location Confirmation Banner */}
      {coordinates && coordinates.length === 2 ? (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-emerald-900 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>GPS Attendance Coordinates Confirmed</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Latitude: {coordinates[1].toFixed(5)}°N, Longitude: {coordinates[0].toFixed(5)}°E
            </p>
            {isReverseGeocoding && (
              <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600 inline" /> Updating address description...
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-600">Workers must check in within 200m</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Please search your shift venue or drop a pin on the map to save verified GPS coordinates.</span>
        </div>
      )}
    </div>
  );
};
