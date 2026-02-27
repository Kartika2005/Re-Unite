import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import type {
  MissingPersonRequest,
  RequestStatus,
  DuplicateAlert,
} from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { useSocket, SocketEvents } from "../../hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Users,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Eye,
  Scan,
  FileText,
} from "lucide-react";

const STATUS_FILTERS: (RequestStatus | "ALL")[] = [
  "ALL",
  "REPORTED",
  "UNDER_REVIEW",
  "SCANNING",
  "FOUND",
  "DECLINED",
  "DISCARDED",
];

export function PoliceDashboard() {
  const [requests, setRequests] = useState<MissingPersonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<RequestStatus | "ALL">("ALL");
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const navigate = useNavigate();
  const socket = useSocket();

  const stats = useMemo(() => {
    const total = requests.length;
    const scanning = requests.filter((r) => r.status === "SCANNING").length;
    const found = requests.filter((r) => r.status === "FOUND").length;
    const reported = requests.filter((r) => r.status === "REPORTED").length;
    return { total, scanning, found, reported };
  }, [requests]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getAllRequests(
        filter === "ALL" ? undefined : filter
      );
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const alerts = await api.getDuplicateAlerts();
      setDuplicateAlerts(alerts);
    } catch {
      // silent — alerts are non-critical
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchAlerts();
  }, [filter]);

  useEffect(() => {
    const onCreated = (data: { request: MissingPersonRequest }) => {
      setRequests((prev) => {
        if (filter !== "ALL" && data.request.status !== filter) return prev;
        if (prev.some((r) => r._id === data.request._id)) return prev;
        return [data.request, ...prev];
      });
    };

    const onUpdated = (data: {
      requestId: string;
      request: MissingPersonRequest;
    }) => {
      setRequests((prev) =>
        prev
          .map((r) => (r._id === data.requestId ? data.request : r))
          .filter((r) => filter === "ALL" || r.status === filter)
      );
    };

    socket.on(SocketEvents.REQUEST_CREATED, onCreated);
    socket.on(SocketEvents.REQUEST_UPDATED, onUpdated);
    socket.on(
      SocketEvents.SCAN_COMPLETED,
      (data: { requestId: string; request: MissingPersonRequest }) => {
        onUpdated({ requestId: data.requestId, request: data.request });
      }
    );
    socket.on(SocketEvents.DUPLICATE_DETECTED, () => {
      fetchAlerts();
    });

    return () => {
      socket.off(SocketEvents.REQUEST_CREATED, onCreated);
      socket.off(SocketEvents.REQUEST_UPDATED, onUpdated);
      socket.off(SocketEvents.SCAN_COMPLETED);
      socket.off(SocketEvents.DUPLICATE_DETECTED);
    };
  }, [socket, filter]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Stat Widgets ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Cases" value={stats.total} icon={Users} className="text-primary" />
        <StatCard title="New Reports" value={stats.reported} icon={FileText} className="text-blue-600" />
        <StatCard title="Scanning" value={stats.scanning} icon={Scan} className="text-violet-600" />
        <StatCard title="Found" value={stats.found} icon={CheckCircle} className="text-emerald-600" />
      </div>

      {/* ── Duplicate Alerts ── */}
      {duplicateAlerts.length > 0 && (
        <Collapsible open={showAlerts} onOpenChange={setShowAlerts}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex-row items-center justify-between py-3 px-4 space-y-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold text-amber-800">
                    {duplicateAlerts.length} Potential Duplicate
                    {duplicateAlerts.length > 1 ? "s" : ""} Detected
                  </CardTitle>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 text-amber-600 transition-transform",
                    showAlerts && "rotate-180"
                  )}
                />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-2">
                {duplicateAlerts.map((alert) => (
                  <DuplicateAlertRow
                    key={alert._id}
                    alert={alert}
                    onView={(id) => navigate(`/police/requests/${id}`)}
                  />
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ── Filters ── */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="text-xs"
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
          </Button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="size-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No requests found</p>
            <p className="text-sm">Try changing the filter or check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Gender</TableHead>
                <TableHead className="hidden md:table-cell">Blood Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Reported</TableHead>
                <TableHead className="w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow
                  key={req._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/police/requests/${req._id}`)}
                >
                  <TableCell>
                    <Avatar className="size-9">
                      <AvatarImage src={req.photoUrl} alt={req.name} className="object-cover" />
                      <AvatarFallback className="text-xs">
                        {req.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{req.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{req.gender}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{req.bloodGroup}</TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/police/requests/${req._id}`);
                      }}
                    >
                      <Eye className="size-4 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, className }: {
  title: string; value: number; icon: React.ElementType; className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("flex items-center justify-center size-10 rounded-lg bg-muted", className)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DuplicateAlertRow({ alert, onView }: { alert: DuplicateAlert; onView: (id: string) => void }) {
  const severityConfig: Record<string, { bg: string; text: string; badge: string }> = {
    CRITICAL: { bg: "bg-red-50", text: "text-red-800", badge: "bg-red-200 text-red-800" },
    HIGH: { bg: "bg-orange-50", text: "text-orange-800", badge: "bg-orange-200 text-orange-800" },
    MEDIUM: { bg: "bg-amber-50", text: "text-amber-800", badge: "bg-amber-200 text-amber-800" },
  };
  const sc = severityConfig[alert.severity] || severityConfig.MEDIUM;
  const matchLabel = alert.matchType === "BOTH" ? "Face + Aadhaar" : alert.matchType === "AADHAAR" ? "Aadhaar Match" : "Face Match";

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border border-amber-200", sc.bg)}>
      <div className="flex items-center gap-1 shrink-0">
        <Avatar className="size-10 ring-2 ring-red-400">
          <AvatarImage src={alert.newRequest?.photoUrl} className="object-cover" />
          <AvatarFallback className="text-xs">N</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground text-sm">↔</span>
        <Avatar className="size-10 ring-2 ring-amber-400">
          <AvatarImage src={alert.existingRequest?.photoUrl} className="object-cover" />
          <AvatarFallback className="text-xs">E</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm truncate", sc.text)}>
          {alert.newRequest?.name || "Unknown"} ↔ {alert.existingRequest?.name || "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{matchLabel} · {Math.round(alert.score * 100)}% similarity</p>
      </div>
      <Badge variant="secondary" className={cn("text-[10px] font-bold shrink-0", sc.badge)}>{alert.severity}</Badge>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="default" className="h-7 text-xs px-2" onClick={() => onView(alert.newRequestId)}>New</Button>
        <Button size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={() => onView(alert.existingRequestId)}>Existing</Button>
      </div>
    </div>
  );
}
