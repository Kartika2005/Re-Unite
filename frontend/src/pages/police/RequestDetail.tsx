import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as api from "../../api";
import type { MissingPersonRequest, PoliceNote, ScanResult, Tip, CaseEvent as CaseEventType, BountyTransaction } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { LocationPicker } from "../../components/LocationPicker";
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, AlertTriangle, FileText, RefreshCw, Trash2, CreditCard, Search,
  CheckCircle, ClipboardList, Lightbulb, Coins, Trophy, Handshake,
  MapPin, Camera, Eye, Copy, QrCode, Phone, Loader2, XCircle,
  ScanLine, ChevronRight, Link2, X, Clock, Send, IndianRupee,
} from "lucide-react";

const CCTV_CAMERAS = ["CCTV-001", "CCTV-002", "CCTV-003", "CCTV-004"];

const EVENT_CONFIG: Record<string, { icon: ReactNode; bg: string; label: string }> = {
  REPORT_CREATED: { icon: <FileText className="h-3 w-3" />, bg: "bg-blue-100 text-blue-600", label: "Report Created" },
  STATUS_CHANGED: { icon: <RefreshCw className="h-3 w-3" />, bg: "bg-amber-100 text-amber-600", label: "Status Changed" },
  DISCARDED: { icon: <Trash2 className="h-3 w-3" />, bg: "bg-gray-100 text-gray-500", label: "Request Discarded" },
  AADHAAR_FETCHED: { icon: <CreditCard className="h-3 w-3" />, bg: "bg-sky-100 text-sky-600", label: "Aadhaar Info Fetched" },
  SCAN_TRIGGERED: { icon: <Search className="h-3 w-3" />, bg: "bg-violet-100 text-violet-600", label: "Face Scan Started" },
  SCAN_COMPLETED: { icon: <CheckCircle className="h-3 w-3" />, bg: "bg-green-100 text-green-600", label: "Scan Results Received" },
  NOTE_ADDED: { icon: <ClipboardList className="h-3 w-3" />, bg: "bg-orange-100 text-orange-600", label: "Investigation Note Added" },
  TIP_RECEIVED: { icon: <Lightbulb className="h-3 w-3" />, bg: "bg-yellow-100 text-yellow-600", label: "Public Tip Received" },
  DUPLICATE_DETECTED: { icon: <AlertTriangle className="h-3 w-3" />, bg: "bg-red-100 text-red-600", label: "Duplicate Case Detected" },
  BOUNTY_PAID: { icon: <Coins className="h-3 w-3" />, bg: "bg-green-100 text-green-600", label: "Bounty Payment Received" },
  BOUNTY_AWARDED: { icon: <Trophy className="h-3 w-3" />, bg: "bg-amber-100 text-amber-600", label: "Bounty Awarded to Tipper" },
  BOUNTY_RELEASED: { icon: <Handshake className="h-3 w-3" />, bg: "bg-blue-100 text-blue-600", label: "Bounty Released to Tipper" },
};

async function generateMissingPersonPDF(
  request: MissingPersonRequest,
  locationName: string,
  tipUrl: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MISSING PERSON", pageWidth / 2, 16, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("REUNITE — Help Bring Them Home", pageWidth / 2, 28, { align: "center" });

  let y = 46;

  // Photo — try to embed the image
  try {
    const img = await loadImageAsDataUrl(request.photoUrl);
    doc.addImage(img, "JPEG", (pageWidth - 60) / 2, y, 60, 60);
    y += 68;
  } catch {
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.text("[Photo could not be loaded]", pageWidth / 2, y + 30, { align: "center" });
    y += 68;
  }

  // Details
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const name = request.name || "Unidentified Person";
  doc.text(name, pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  const details: [string, string][] = [];
  if (request.gender) details.push(["Gender", request.gender]);
  if (request.bloodGroup) details.push(["Blood Group", request.bloodGroup]);
  if (request.dateOfBirth) details.push(["Date of Birth", new Date(request.dateOfBirth).toLocaleDateString()]);
  details.push(["Status", request.status.replace("_", " ")]);
  details.push(["Reported On", new Date(request.createdAt).toLocaleDateString()]);
  if (locationName) details.push(["Last Seen Near", locationName]);
  if (request.lastKnownLocation) {
    const { latitude, longitude } = request.lastKnownLocation;
    details.push(["Google Maps", `https://www.google.com/maps?q=${latitude},${longitude}`]);
  }

  const labelX = 30;
  const valueX = 75;
  const maxValueWidth = pageWidth - valueX - 20;

  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, labelX, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, maxValueWidth);
    doc.text(lines, valueX, y);
    y += 7 * lines.length;
  }

  y += 8;

  // QR section
  doc.setDrawColor(203, 213, 225);
  doc.line(30, y, pageWidth - 30, y);
  y += 10;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Have information? Scan to submit a tip:", pageWidth / 2, y, { align: "center" });
  y += 8;

  const qrDataUrl = await QRCode.toDataURL(tipUrl, { width: 300, margin: 1 });
  doc.addImage(qrDataUrl, "PNG", (pageWidth - 50) / 2, y, 50, 50);
  y += 56;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(tipUrl, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: "center" });

  doc.save(`missing-person-${request._id.slice(-6)}.pdf`);
}

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no ctx")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<MissingPersonRequest | null>(null);
  const [notes, setNotes] = useState<PoliceNote[]>([]);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [noteText, setNoteText] = useState("");
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  const [selectedTip, setSelectedTip] = useState<Tip | null>(null);
  const [scanningCameras, setScanningCameras] = useState<string[]>([]);
  const [locationName, setLocationName] = useState<string>("");
  const [tipLocationNames, setTipLocationNames] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<CaseEventType[]>([]);
  const [duplicateAlerts, setDuplicateAlerts] = useState<import("../../types").DuplicateAlert[]>([]);
  const [bounty, setBounty] = useState<BountyTransaction | null>(null);
  const [bountyLoading, setBountyLoading] = useState("");
  const socket = useSocket();

  const fetchData = async () => {
    if (!id) return;
    try {
      const data = await api.getRequestById(id);
      setRequest(data.request);
      setNotes(data.notes);
      setScans(data.scans);
      setTips(data.tips || []);
      setEvents(data.events || []);

      // If status is SCANNING but no results yet, show spinners
      if (data.request.status === "SCANNING" && data.scans.length === 0) {
        setScanningCameras([...CCTV_CAMERAS]);
      } else {
        setScanningCameras([]);
      }

      // Fetch duplicate alerts for this case
      api.getRequestDuplicates(id).then(setDuplicateAlerts).catch(() => {});
      // Fetch bounty info
      api.getBounty(id).then(setBounty).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Real-time updates via WebSocket (replaces polling)
  useEffect(() => {
    if (!id) return;

    const onUpdated = (data: { requestId: string; request: MissingPersonRequest }) => {
      if (data.requestId !== id) return;
      setRequest(data.request);
      // Re-fetch events to get the latest timeline
      api.getRequestById(id).then((d) => setEvents(d.events || [])).catch(() => {});
    };

    const onScanCompleted = (data: { requestId: string; scans: ScanResult[]; request: MissingPersonRequest }) => {
      if (data.requestId !== id) return;
      setScans(data.scans);
      setRequest(data.request);
      setScanningCameras([]);
      api.getRequestById(id).then((d) => setEvents(d.events || [])).catch(() => {});
    };

    const onNoteAdded = (data: { requestId: string; note: PoliceNote; event: CaseEventType }) => {
      if (data.requestId !== id) return;
      setNotes((prev) => [data.note, ...prev]);
      setEvents((prev) => [...prev, data.event]);
    };

    const onTipReceived = (data: { requestId: string; tip: Tip; event: CaseEventType }) => {
      if (data.requestId !== id) return;
      setTips((prev) => [data.tip, ...prev]);
      setEvents((prev) => [...prev, data.event]);
    };

    socket.on(SocketEvents.REQUEST_UPDATED, onUpdated);
    socket.on(SocketEvents.SCAN_COMPLETED, onScanCompleted);
    socket.on(SocketEvents.NOTE_ADDED, onNoteAdded);
    socket.on(SocketEvents.TIP_RECEIVED, onTipReceived);
    socket.on(SocketEvents.DUPLICATE_DETECTED, () => {
      if (id) api.getRequestDuplicates(id).then(setDuplicateAlerts).catch(() => {});
    });

    return () => {
      socket.off(SocketEvents.REQUEST_UPDATED, onUpdated);
      socket.off(SocketEvents.SCAN_COMPLETED, onScanCompleted);
      socket.off(SocketEvents.NOTE_ADDED, onNoteAdded);
      socket.off(SocketEvents.TIP_RECEIVED, onTipReceived);
      socket.off(SocketEvents.DUPLICATE_DETECTED);
    };
  }, [id, socket]);

  // Reverse-geocode the last known location to get a place name
  useEffect(() => {
    if (!request) return;
    const { latitude, longitude } = request.lastKnownLocation;
    const key = import.meta.env.VITE_GEOAPIFY_KEY || "";
    if (!key) {
      setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      return;
    }
    fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${key}`
    )
      .then((res) => res.json())
      .then((data) => {
        const name = data.features?.[0]?.properties?.formatted;
        setLocationName(name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      })
      .catch(() => {
        setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      });
  }, [request?.lastKnownLocation.latitude, request?.lastKnownLocation.longitude]);

  // Reverse-geocode tip locations
  useEffect(() => {
    const key = import.meta.env.VITE_GEOAPIFY_KEY || "";
    if (!key || tips.length === 0) return;

    const tipsWithLocation = tips.filter((t) => t.location && !tipLocationNames[t._id]);
    if (tipsWithLocation.length === 0) return;

    tipsWithLocation.forEach((tip) => {
      if (!tip.location) return;
      fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${tip.location.latitude}&lon=${tip.location.longitude}&apiKey=${key}`
      )
        .then((res) => res.json())
        .then((data) => {
          const name = data.features?.[0]?.properties?.formatted;
          if (name) {
            setTipLocationNames((prev) => ({ ...prev, [tip._id]: name }));
          }
        })
        .catch(() => {});
    });
  }, [tips]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setActionLoading(newStatus);
    setError("");
    try {
      const updated = await api.updateRequestStatus(id, newStatus as any);
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setActionLoading("");
    }
  };

  const handleDiscard = async () => {
    if (!id) return;
    setActionLoading("DISCARD");
    setError("");
    try {
      const updated = await api.discardRequest(id);
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard");
    } finally {
      setActionLoading("");
    }
  };

  const handleScan = async () => {
    if (!id) return;
    setActionLoading("SCAN");
    setError("");
    setScanningCameras([...CCTV_CAMERAS]);
    try {
      const results = await api.triggerScan(id);
      setScans((prev) => [...results, ...prev]);
      setRequest((prev) => (prev ? { ...prev, status: "SCANNING" } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setActionLoading("");
      setScanningCameras([]);
    }
  };

  const handleFetchAadhaar = async () => {
    if (!id) return;
    setActionLoading("FETCH_AADHAAR");
    setError("");
    try {
      const updated = await api.fetchAadhaarInfo(id);
      setRequest(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch Aadhaar info"
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !noteText.trim()) return;
    setActionLoading("NOTE");
    setError("");
    try {
      const note = await api.addNote(id, noteText);
      setNotes((prev) => [note, ...prev]);
      setNoteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setActionLoading("");
    }
  };

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  if (!request)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <XCircle className="h-12 w-12 mb-4 text-destructive" />
        <p className="text-lg font-medium">Request not found</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/police/dashboard")} className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>

      {/* ── Duplicate Warning Section ── */}
      {duplicateAlerts.length > 0 && (
        <Card className="border-destructive bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-base">
              <AlertTriangle className="h-5 w-5" />
              Potential Duplicate Cases ({duplicateAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {duplicateAlerts.map((alert) => {
              const isNew = alert.newRequestId === id;
              const otherReq = isNew ? alert.existingRequest : alert.newRequest;
              const otherLabel = isNew ? "Existing Case" : "New Case";
              const otherId = isNew ? alert.existingRequestId : alert.newRequestId;

              const sevMap: Record<string, string> = {
                CRITICAL: "bg-red-500",
                HIGH: "bg-orange-500",
                MEDIUM: "bg-yellow-500",
              };
              const sevBadge: Record<string, string> = {
                CRITICAL: "bg-red-100 text-red-700 border-red-200",
                HIGH: "bg-orange-100 text-orange-700 border-orange-200",
                MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
              };
              const matchLabel = alert.matchType === "BOTH" ? "Face + Aadhaar" : alert.matchType === "AADHAAR" ? "Aadhaar" : "Face";

              return (
                <div key={alert._id} className="flex items-center gap-4 rounded-lg bg-white/80 p-3 border">
                  {/* Side-by-side comparison */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-center">
                      <Avatar className="h-12 w-12 ring-2 ring-blue-400">
                        <AvatarImage src={request.photoUrl} />
                        <AvatarFallback>TC</AvatarFallback>
                      </Avatar>
                      <p className="text-[0.6rem] text-muted-foreground mt-0.5">This Case</p>
                    </div>
                    <div className={`h-9 w-9 rounded-full ${sevMap[alert.severity] || "bg-yellow-500"} text-white flex items-center justify-center text-xs font-bold`}>
                      {Math.round(alert.score * 100)}%
                    </div>
                    <div className="text-center">
                      <Avatar className="h-12 w-12 ring-2 ring-amber-400">
                        <AvatarImage src={otherReq?.photoUrl} />
                        <AvatarFallback>OC</AvatarFallback>
                      </Avatar>
                      <p className="text-[0.6rem] text-muted-foreground mt-0.5">{otherLabel}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{otherReq?.name || "Unknown"}</span>
                      <Badge variant="outline" className={`text-[0.65rem] ${sevBadge[alert.severity] || sevBadge.MEDIUM}`}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {matchLabel} match · {alert.status === "LINKED" ? "Linked" : alert.status === "DISMISSED" ? "Dismissed" : "Pending review"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" className="h-7 text-xs" onClick={() => navigate(`/police/requests/${otherId}`)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    {alert.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-green-500 text-green-700 hover:bg-green-50"
                          onClick={async () => {
                            await api.linkDuplicate(alert._id);
                            if (id) api.getRequestDuplicates(id).then(setDuplicateAlerts).catch(() => {});
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" /> Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={async () => {
                            await api.dismissDuplicate(alert._id);
                            if (id) api.getRequestDuplicates(id).then(setDuplicateAlerts).catch(() => {});
                          }}
                        >
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Two-Column Layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-5">
                <Avatar className="h-28 w-28 rounded-xl shrink-0">
                  <AvatarImage src={request.photoUrl} alt={request.name} className="object-cover" />
                  <AvatarFallback className="rounded-xl text-2xl">{request.name?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="text-xl font-bold tracking-tight truncate">{request.name || "Aadhaar Report (Pending Fetch)"}</h2>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                    {request.gender && (
                      <div><span className="font-medium text-foreground">Gender:</span> {request.gender}</div>
                    )}
                    <div><span className="font-medium text-foreground">Blood Group:</span> {request.bloodGroup}</div>
                    {request.dateOfBirth && (
                      <div><span className="font-medium text-foreground">DOB:</span> {new Date(request.dateOfBirth).toLocaleDateString()}</div>
                    )}
                    <div><span className="font-medium text-foreground">Reported:</span> {new Date(request.createdAt).toLocaleString()}</div>
                    {request.aadhaarNo && (
                      <div><span className="font-medium text-foreground">Aadhaar:</span> {request.aadhaarNo}</div>
                    )}
                    {request.phoneNumber && (
                      <div><span className="font-medium text-foreground">Phone:</span> {request.phoneNumber}</div>
                    )}
                    {request.address && (
                      <div className="col-span-2"><span className="font-medium text-foreground">Address:</span> {request.address}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Known Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" /> Last Known Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {locationName && (
                <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {locationName}
                </p>
              )}
              <LocationPicker
                readOnly
                value={{
                  latitude: request.lastKnownLocation.latitude,
                  longitude: request.lastKnownLocation.longitude,
                  displayName: `${request.lastKnownLocation.latitude.toFixed(4)}, ${request.lastKnownLocation.longitude.toFixed(4)}`,
                }}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {request.status === "REPORTED" && (
                  <>
                    {request.aadhaarNo && !request.name && (
                      <Button variant="outline" className="border-sky-600 text-sky-700 hover:bg-sky-50" disabled={actionLoading === "FETCH_AADHAAR"} onClick={handleFetchAadhaar}>
                        {actionLoading === "FETCH_AADHAAR" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CreditCard className="h-4 w-4 mr-1.5" />}
                        Fetch Aadhaar Info
                      </Button>
                    )}
                    <Button variant="outline" className="border-amber-600 text-amber-700 hover:bg-amber-50" disabled={actionLoading === "UNDER_REVIEW"} onClick={() => handleStatusChange("UNDER_REVIEW")}>
                      {actionLoading === "UNDER_REVIEW" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                      Move to Under Review
                    </Button>
                    <Button variant="outline" className="text-muted-foreground" disabled={actionLoading === "DISCARD"} onClick={handleDiscard}>
                      {actionLoading === "DISCARD" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                      Discard
                    </Button>
                  </>
                )}
                {request.status === "UNDER_REVIEW" && (
                  <Button className="bg-violet-600 hover:bg-violet-700" disabled={actionLoading === "SCAN"} onClick={handleScan}>
                    {actionLoading === "SCAN" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ScanLine className="h-4 w-4 mr-1.5" />}
                    Run Face Scan
                  </Button>
                )}
                {request.status === "SCANNING" && scans.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-violet-600 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Face scan in progress... Results will appear automatically.
                  </div>
                )}
                {request.status === "SCANNING" && scans.length > 0 && (
                  <>
                    <Button className="bg-green-600 hover:bg-green-700" disabled={actionLoading === "FOUND"} onClick={() => handleStatusChange("FOUND")}>
                      {actionLoading === "FOUND" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
                      Mark as Found
                    </Button>
                    <Button variant="destructive" disabled={actionLoading === "DECLINED"} onClick={() => handleStatusChange("DECLINED")}>
                      {actionLoading === "DECLINED" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                      Decline
                    </Button>
                  </>
                )}
                {["FOUND", "DECLINED", "DISCARDED"].includes(request.status) && (
                  <p className="text-sm text-muted-foreground">
                    This request has been resolved. No further actions available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Case Timeline */}
          {events.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" /> Case Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-8">
                  {/* Vertical line */}
                  <div className="absolute left-[0.6875rem] top-1 bottom-1 w-0.5 bg-border" />
                  {events.map((evt, i) => {
                    const cfg = EVENT_CONFIG[evt.action] || { icon: <FileText className="h-3 w-3" />, bg: "bg-gray-100 text-gray-500", label: evt.action };
                    return (
                      <div key={evt._id} className={i < events.length - 1 ? "pb-5" : ""}>
                        <div className="relative">
                          {/* Dot */}
                          <div className={`absolute -left-[1.625rem] top-0.5 h-5 w-5 rounded-full ${cfg.bg} flex items-center justify-center z-[1]`}>
                            {cfg.icon}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{cfg.label}</p>
                            {evt.details && <p className="text-xs text-muted-foreground mt-0.5">{evt.details}</p>}
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{new Date(evt.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanning Cameras */}
          {scanningCameras.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4 text-violet-600" /> Scanning CCTV Feeds...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {scanningCameras.map((cam) => (
                    <div key={cam} className="flex flex-col items-center gap-3 rounded-lg border bg-muted/50 p-5">
                      <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
                      <p className="font-semibold text-sm">{cam}</p>
                      <p className="text-xs text-muted-foreground">Analyzing footage...</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scan Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="h-4 w-4 text-primary" /> Scan Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scans.length === 0 && scanningCameras.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scans performed yet.</p>
              ) : scans.length === 0 ? null : (
                <div className="space-y-3">
                  {scans.map((scan) => {
                    const isFound = scan.status === "found";
                    const isNotFound = scan.status === "not_found";
                    return (
                      <div
                        key={scan._id}
                        onClick={() => setSelectedScan(scan)}
                        className={`rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                          isFound ? "border-green-500" : isNotFound ? "border-red-400" : "border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex-1">
                            <Badge variant="outline" className={`text-xs font-bold mb-1.5 ${
                              isFound ? "bg-green-100 text-green-700 border-green-200" : isNotFound ? "bg-red-100 text-red-700 border-red-200" : "bg-gray-100 text-gray-600"
                            }`}>
                              {isFound ? "MATCH FOUND" : isNotFound ? "NO MATCH" : "ERROR"}
                            </Badge>
                            <p className="font-semibold text-sm">
                              Confidence:{" "}
                              <span className={scan.confidenceScore >= 80 ? "text-green-600" : scan.confidenceScore >= 60 ? "text-amber-600" : "text-red-600"}>
                                {scan.confidenceScore}%
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              CCTV: {scan.cctvId} · {new Date(scan.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        {isFound && scan.bestMatchImageUrl && (
                          <img src={scan.bestMatchImageUrl} alt="Match" className="w-full h-44 rounded-md object-cover bg-muted" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Detail Dialog */}
          <Dialog open={!!selectedScan} onOpenChange={() => setSelectedScan(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedScan && (
                    <>
                      <Badge variant="outline" className={`text-xs font-bold ${
                        selectedScan.status === "found" ? "bg-green-100 text-green-700 border-green-200" : selectedScan.status === "not_found" ? "bg-red-100 text-red-700 border-red-200" : "bg-gray-100 text-gray-600"
                      }`}>
                        {selectedScan.status === "found" ? "MATCH FOUND" : selectedScan.status === "not_found" ? "NO MATCH" : "ERROR"}
                      </Badge>
                      <span>CCTV: {selectedScan.cctvId}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {new Date(selectedScan.createdAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedScan && (
                <div>
                  {selectedScan.status === "found" && selectedScan.bestMatchImageUrl ? (
                    <img src={selectedScan.bestMatchImageUrl} alt="Match detail" className="w-full rounded-lg object-contain bg-muted max-h-[60vh]" />
                  ) : (
                    <div className="w-full h-52 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {selectedScan.status === "error" ? "Scan encountered an error" : "No matching face detected"}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="font-semibold text-lg">
                      Confidence:{" "}
                      <span className={selectedScan.confidenceScore >= 80 ? "text-green-600" : selectedScan.confidenceScore >= 60 ? "text-amber-600" : "text-red-600"}>
                        {selectedScan.confidenceScore}%
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Investigation Notes */}
          {scans.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-primary" /> Investigation Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      A note is required before resolving this request.
                    </p>
                    <form onSubmit={handleAddNote} className="flex gap-2">
                      <Input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add investigation note..."
                        className="flex-1"
                      />
                      <Button type="submit" disabled={actionLoading === "NOTE" || !noteText.trim()}>
                        {actionLoading === "NOTE" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                        Add Note
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="rounded-md bg-muted/50 border p-4">
                    <p className="font-medium">{notes[0].note}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(notes[0].createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bounty Section */}
          {bounty && bounty.amount > 0 && (
            <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-800">
                    <Trophy className="h-5 w-5" /> Bounty Reward
                  </CardTitle>
                  <span className="text-xl font-bold text-amber-700 flex items-center">
                    <IndianRupee className="h-5 w-5" />{bounty.amount.toLocaleString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <Badge variant="outline" className={`font-semibold ${
                    bounty.status === "PAYMENT_COMPLETED" ? "bg-green-100 text-green-700 border-green-200"
                      : bounty.status === "RELEASED_TO_TIPPER" ? "bg-blue-100 text-blue-700 border-blue-200"
                      : bounty.status === "PAYMENT_FAILED" ? "bg-red-100 text-red-700 border-red-200"
                      : bounty.status === "CANCELLED" ? "bg-gray-100 text-gray-600"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}>
                    {bounty.status.replace(/_/g, " ")}
                  </Badge>
                  {bounty.awardedTipperContact && (
                    <span className="text-sm text-muted-foreground">Awarded to: {bounty.awardedTipperContact}</span>
                  )}
                  {bounty.paidAt && (
                    <span className="text-xs text-muted-foreground">Paid: {new Date(bounty.paidAt).toLocaleString()}</span>
                  )}
                </div>

                {/* Award bounty to a tipper */}
                {request.status === "FOUND" && bounty.status === "PLEDGED" && tips.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Select a tip to award the bounty to:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tips
                        .filter((t) => t.contactInfo)
                        .map((tip) => (
                          <Button
                            key={tip._id}
                            variant="outline"
                            size="sm"
                            className="border-amber-500 text-amber-700 hover:bg-amber-100"
                            disabled={bountyLoading === "AWARD"}
                            onClick={async () => {
                              setBountyLoading("AWARD");
                              try {
                                const updated = await api.awardBounty(id!, tip._id);
                                setBounty(updated);
                                fetchData();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to award bounty");
                              } finally {
                                setBountyLoading("");
                              }
                            }}
                          >
                            <Trophy className="h-3.5 w-3.5 mr-1" /> Award to {tip.contactInfo}
                          </Button>
                        ))}
                      {tips.every((t) => !t.contactInfo) && (
                        <span className="text-xs text-muted-foreground italic">
                          No tips with contact info available for reward.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Release bounty */}
                {bounty.status === "PAYMENT_COMPLETED" && (
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    disabled={bountyLoading === "RELEASE"}
                    onClick={async () => {
                      setBountyLoading("RELEASE");
                      try {
                        const updated = await api.releaseBounty(id!);
                        setBounty(updated);
                        fetchData();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to release");
                      } finally {
                        setBountyLoading("");
                      }
                    }}
                  >
                    {bountyLoading === "RELEASE" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Handshake className="h-4 w-4 mr-1.5" />}
                    {bountyLoading === "RELEASE" ? "Processing..." : "Mark Released to Tipper"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Public Tips */}
          {request.status !== "REPORTED" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-amber-500" /> Public Tips ({tips.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-sky-600 text-sky-700 hover:bg-sky-50"
                      onClick={() => {
                        const url = `${window.location.origin}/tip/${id}`;
                        navigator.clipboard.writeText(url);
                        alert("Tip link copied to clipboard!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Tip Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-violet-600 text-violet-700 hover:bg-violet-50"
                      onClick={() => {
                        if (!request) return;
                        const tipUrl = `${window.location.origin}/tip/${id}`;
                        generateMissingPersonPDF(request, locationName, tipUrl);
                      }}
                    >
                      <QrCode className="h-3.5 w-3.5 mr-1" /> Share QR
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tips received yet. Share the tip link to crowdsource information.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {tips.map((tip) => (
                      <div
                        key={tip._id}
                        onClick={() => tip.location ? setSelectedTip(tip) : undefined}
                        className={`rounded-lg border border-amber-200 bg-amber-50 p-4 transition-all ${
                          tip.location ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
                        }`}
                      >
                        <p className="font-medium text-sm mb-1.5">{tip.message}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>{new Date(tip.createdAt).toLocaleString()}</span>
                          {tip.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-primary" />
                              {tipLocationNames[tip._id] || `${tip.location.latitude.toFixed(4)}, ${tip.location.longitude.toFixed(4)}`}
                              <span className="text-muted-foreground/60 ml-1">Click to view map</span>
                            </span>
                          )}
                          {tip.contactInfo && (
                            <span className="flex items-center gap-1 text-sky-600">
                              <Phone className="h-3 w-3" /> {tip.contactInfo}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tip Detail Dialog */}
          <Dialog open={!!selectedTip && !!selectedTip.location} onOpenChange={() => setSelectedTip(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Tip Sighting Location
                  {selectedTip && (
                    <span className="text-sm text-muted-foreground font-normal ml-2">
                      {new Date(selectedTip.createdAt).toLocaleString()}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedTip && selectedTip.location && (
                <div>
                  <div className="mb-4 space-y-2">
                    <p className="font-medium text-sm">"{selectedTip.message}"</p>
                    {selectedTip.contactInfo && (
                      <p className="text-sm text-sky-600 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {selectedTip.contactInfo}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Location:</span>{" "}
                      {tipLocationNames[selectedTip._id] || "Resolving..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Coordinates:</span>{" "}
                      {selectedTip.location.latitude.toFixed(6)}, {selectedTip.location.longitude.toFixed(6)}
                    </p>
                  </div>
                  <LocationPicker
                    value={{
                      latitude: selectedTip.location.latitude,
                      longitude: selectedTip.location.longitude,
                      displayName: tipLocationNames[selectedTip._id] || "",
                    }}
                    readOnly
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Right Column (1/3) — Quick Info Sidebar ── */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Case Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={request.status} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Scans</span>
                <span className="font-semibold text-sm">{scans.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tips</span>
                <span className="font-semibold text-sm">{tips.length}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Notes</span>
                <span className="font-semibold text-sm">{notes.length}</span>
              </div>
              {bounty && bounty.amount > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bounty</span>
                    <span className="font-semibold text-sm text-amber-700 flex items-center">
                      <IndianRupee className="h-3.5 w-3.5" />{bounty.amount.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              {duplicateAlerts.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duplicates</span>
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                      {duplicateAlerts.length}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/tip/${id}`;
                  navigator.clipboard.writeText(url);
                  alert("Tip link copied!");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Tip Link
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => {
                  if (!request) return;
                  const tipUrl = `${window.location.origin}/tip/${id}`;
                  generateMissingPersonPDF(request, locationName, tipUrl);
                }}
              >
                <QrCode className="h-4 w-4 mr-2" /> Generate Poster PDF
              </Button>
            </CardContent>
          </Card>

          {/* Recent Events (compact sidebar version) */}
          {events.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {events.slice(-5).reverse().map((evt) => {
                      const cfg = EVENT_CONFIG[evt.action] || { icon: <FileText className="h-3 w-3" />, bg: "bg-gray-100 text-gray-500", label: evt.action };
                      return (
                        <div key={evt._id} className="flex items-start gap-2.5">
                          <div className={`h-6 w-6 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            {cfg.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-tight">{cfg.label}</p>
                            <p className="text-[0.65rem] text-muted-foreground">{new Date(evt.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

