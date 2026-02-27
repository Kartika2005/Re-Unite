import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { getPublicCases, type PublicCase } from "../api";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, FileText, ScanLine, CheckCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  REPORTED: "#f59e0b",
  UNDER_REVIEW: "#3b82f6",
  SCANNING: "#8b5cf6",
  FOUND: "#22c55e",
  DECLINED: "#ef4444",
};

const RADIUS_OPTIONS = [
  { label: "1 km", value: "1" },
  { label: "5 km", value: "5" },
  { label: "10 km", value: "10" },
  { label: "25 km", value: "25" },
  { label: "50 km", value: "50" },
];

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export function CaseMap() {
  const [cases, setCases] = useState<PublicCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(10);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    getPublicCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        const zoom = radius <= 1 ? 14 : radius <= 5 ? 12 : radius <= 10 ? 11 : radius <= 25 ? 10 : 9;
        setFlyTarget({ center: loc, zoom });
      },
      () => alert("Unable to retrieve your location.")
    );
  };

  const nearbyCases = userLocation
    ? cases.filter(
        (c) =>
          haversineDistance(userLocation[0], userLocation[1], c.lastKnownLocation.latitude, c.lastKnownLocation.longitude) <= radius
      )
    : [];

  const defaultCenter: [number, number] = [20.5937, 78.9629];

  const statCards = [
    { label: "Total Cases", value: cases.length, icon: Users, color: "text-foreground" },
    { label: "Reported", value: cases.filter((c) => c.status === "REPORTED").length, icon: FileText, color: "text-amber-500" },
    { label: "Scanning", value: cases.filter((c) => c.status === "SCANNING").length, icon: ScanLine, color: "text-violet-500" },
    { label: "Found", value: cases.filter((c) => c.status === "FOUND").length, icon: CheckCircle, color: "text-green-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleLocateMe}>
              <MapPin className="h-4 w-4 mr-1.5" /> Use My Location
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Radius:</span>
              <Select value={String(radius)} onValueChange={(v) => {
                const r = Number(v);
                setRadius(r);
                if (userLocation) {
                  const zoom = r <= 1 ? 14 : r <= 5 ? 12 : r <= 10 ? 11 : r <= 25 ? 10 : 9;
                  setFlyTarget({ center: userLocation, zoom });
                }
              }}>
                <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {userLocation && (
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-sm font-semibold">
                {nearbyCases.length} case{nearbyCases.length !== 1 ? "s" : ""} within {radius} km
              </Badge>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full border border-muted-foreground/30" style={{ backgroundColor: color }} />
                {status.replace("_", " ")}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      {loading ? (
        <Skeleton className="h-[500px] w-full rounded-xl" />
      ) : (
        <Card className="overflow-hidden">
          <MapContainer center={defaultCenter} zoom={5} style={{ height: 500, width: "100%" }} ref={mapRef}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}
            {userLocation && (
              <Circle center={userLocation} radius={radius * 1000} pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08, weight: 2, dashArray: "6 4" }} />
            )}
            {userLocation && (
              <CircleMarker center={userLocation} radius={7} pathOptions={{ color: "#fff", fillColor: "#2563eb", fillOpacity: 1, weight: 2 }}>
                <Popup>Your location</Popup>
              </CircleMarker>
            )}
            {cases.map((c) => (
              <CircleMarker
                key={c._id}
                center={[c.lastKnownLocation.latitude, c.lastKnownLocation.longitude]}
                radius={6}
                pathOptions={{ color: "#fff", fillColor: STATUS_COLORS[c.status] || "#64748b", fillOpacity: 0.9, weight: 1.5 }}
              >
                <Popup>
                  <div className="text-sm leading-relaxed">
                    <strong>{c.name || "Aadhaar Report"}</strong><br />
                    Status: {c.status.replace("_", " ")}
                    {c.gender && <><br />Gender: {c.gender}</>}
                    {c.bloodGroup && <><br />Blood: {c.bloodGroup}</>}
                    <br /><span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Card>
      )}
    </div>
  );
}
