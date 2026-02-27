import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Crosshair, Loader2 } from "lucide-react";

// Fix Leaflet default marker icons (broken by bundlers like Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || "";
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

export interface LocationValue {
  latitude: number;
  longitude: number;
  displayName: string;
}

interface LocationPickerProps {
  value?: LocationValue;
  onChange?: (value: LocationValue) => void;
  readOnly?: boolean;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}`
    );
    const data = await res.json();
    return data.features?.[0]?.properties?.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

async function forwardGeocode(
  query: string
): Promise<{ lat: number; lng: number; name: string }[]> {
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
        query
      )}&limit=5&apiKey=${GEOAPIFY_KEY}`
    );
    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      lat: f.properties.lat,
      lng: f.properties.lon,
      name: f.properties.formatted,
    }));
  } catch {
    return [];
  }
}

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPosition({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15, { duration: 1.2 });
    }
  }, [position, map]);
  return null;
}

export function LocationPicker({ value, onChange, readOnly }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value?.displayName || "");
  const [suggestions, setSuggestions] = useState<
    { lat: number; lng: number; name: string }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(
    value ? [value.latitude, value.longitude] : null
  );
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setMarkerPos([value.latitude, value.longitude]);
      setSearchQuery(value.displayName);
    }
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const emitChange = useCallback(
    (lat: number, lng: number, name: string) => {
      onChange?.({ latitude: lat, longitude: lng, displayName: name });
    },
    [onChange]
  );

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (readOnly) return;
      setMarkerPos([lat, lng]);
      setFlyTarget([lat, lng]);
      const name = await reverseGeocode(lat, lng);
      setSearchQuery(name);
      emitChange(lat, lng, name);
    },
    [readOnly, emitChange]
  );

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await forwardGeocode(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
  };

  const handleSelectSuggestion = (s: { lat: number; lng: number; name: string }) => {
    setSearchQuery(s.name);
    setMarkerPos([s.lat, s.lng]);
    setFlyTarget([s.lat, s.lng]);
    setSuggestions([]);
    setShowSuggestions(false);
    emitChange(s.lat, s.lng, s.name);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos([lat, lng]);
        setFlyTarget([lat, lng]);
        const name = await reverseGeocode(lat, lng);
        setSearchQuery(name);
        emitChange(lat, lng, name);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      }
    );
  };

  const mapCenter: [number, number] = markerPos || DEFAULT_CENTER;
  const mapZoom = markerPos ? 15 : DEFAULT_ZOOM;

  return (
    <div ref={wrapperRef} className="mb-4 space-y-2">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        Last Known Location {!readOnly && "*"}
      </Label>

      {!readOnly && (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search for a location..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              className="shrink-0 gap-1.5 text-xs"
            >
              {geoLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {geoLoading ? "Locating..." : "Use My Location"}
            </Button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-popover border rounded-b-md max-h-52 overflow-y-auto z-[1000] shadow-md">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectSuggestion(s)}
                  className="px-3 py-2 cursor-pointer text-sm hover:bg-muted border-b last:border-b-0 transition-colors"
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div
        className="rounded-lg overflow-hidden border"
        style={{ height: readOnly ? 250 : 350 }}
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={!readOnly}
          dragging={!readOnly}
          doubleClickZoom={!readOnly}
          zoomControl={!readOnly}
          touchZoom={!readOnly}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <MapClickHandler onClick={handleMapClick} />}
          <FlyToPosition position={flyTarget} />
          {markerPos && <Marker position={markerPos} />}
        </MapContainer>
      </div>

      {/* Coordinates display */}
      {markerPos && (
        <p className="text-xs text-muted-foreground">
          Coordinates: {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}
        </p>
      )}
    </div>
  );
}
