import type { RequestStatus } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileText,
  Search,
  Scan,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  REPORTED: {
    label: "Reported",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: FileText,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Search,
  },
  SCANNING: {
    label: "Scanning",
    className: "bg-violet-100 text-violet-700 border-violet-200",
    icon: Scan,
  },
  FOUND: {
    label: "Found",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
  },
  DECLINED: {
    label: "Declined",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  DISCARDED: {
    label: "Discarded",
    className: "bg-gray-100 text-gray-500 border-gray-200",
    icon: Trash2,
  },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-semibold text-xs px-2.5 py-0.5",
        config.className
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
