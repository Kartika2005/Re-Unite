import { useEffect, useState } from "react";
import * as api from "../../api";
import type { MissingPersonRequest, BountyTransaction } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { useSocket, SocketEvents } from "../../hooks/useSocket";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Trophy, CreditCard, CheckCircle, Loader2, IndianRupee, XCircle,
} from "lucide-react";

export function MyRequests() {
  const [requests, setRequests] = useState<MissingPersonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bounties, setBounties] = useState<Record<string, BountyTransaction | null>>({});
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const socket = useSocket();

  useEffect(() => {
    api
      .getMyRequests()
      .then((reqs) => {
        setRequests(reqs);
        reqs.forEach((r) => {
          if (r.bountyAmount && r.bountyAmount > 0) {
            api.getBounty(r._id).then((b) => {
              setBounties((prev) => ({ ...prev, [r._id]: b }));
            }).catch(() => {});
          }
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Real-time: status changes on citizen's own reports
  useEffect(() => {
    const onUpdated = (data: { requestId: string; request: MissingPersonRequest }) => {
      setRequests((prev) =>
        prev.map((r) => (r._id === data.requestId ? data.request : r))
      );
    };

    socket.on(SocketEvents.REQUEST_UPDATED, onUpdated);
    socket.on(SocketEvents.SCAN_COMPLETED, (data: { requestId: string; request: MissingPersonRequest }) => {
      onUpdated({ requestId: data.requestId, request: data.request });
    });

    return () => {
      socket.off(SocketEvents.REQUEST_UPDATED, onUpdated);
      socket.off(SocketEvents.SCAN_COMPLETED);
    };
  }, [socket]);

  if (loading)
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <XCircle className="h-12 w-12 mb-4 text-destructive" />
        <p className="text-lg font-medium">{error}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No reports submitted yet</p>
            <p className="text-sm mt-1">Your missing person reports will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const b = bounties[req._id] ?? null;
            const hasBounty = !!(req.bountyAmount && req.bountyAmount > 0);
            const needsPay = b && ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(b.status);
            const isPledged = b && b.status === "PLEDGED";
            const isPaid = b && ["PAYMENT_COMPLETED", "RELEASED_TO_TIPPER"].includes(b.status);

            return (
              <Card key={req._id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={req.photoUrl} alt={req.name || "Aadhaar Report"} className="object-cover" />
                      <AvatarFallback className="text-lg">{req.name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{req.name || "Aadhaar Report"}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.gender ? `${req.gender} · ` : ""}
                        {req.bloodGroup} · Reported {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Bounty payment row */}
                  {hasBounty && (
                    <>
                      <Separator className="my-3 border-dashed border-amber-300" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                          <Trophy className="h-4 w-4" /> Bounty: <IndianRupee className="h-3.5 w-3.5" />{req.bountyAmount!.toLocaleString()}
                        </span>
                        {isPledged && (
                          <span className="text-xs text-muted-foreground">
                            Pledged — Awaiting case resolution
                          </span>
                        )}
                        {needsPay && (
                          <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            disabled={payLoading === req._id}
                            onClick={async () => {
                              setPayLoading(req._id);
                              try {
                                localStorage.setItem("bounty_requestId", req._id);
                                const result = await api.initiateBountyPayment(req._id);
                                window.location.href = result.redirectUrl;
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Payment failed");
                                setPayLoading(null);
                              }
                            }}
                          >
                            {payLoading === req._id ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                              <CreditCard className="h-4 w-4 mr-1.5" />
                            )}
                            {payLoading === req._id ? "Redirecting..." : "Pay Bounty"}
                          </Button>
                        )}
                        {isPaid && (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {b!.status === "RELEASED_TO_TIPPER" ? "Released to tipper" : "Payment completed"}
                          </Badge>
                        )}
                        {b && b.status === "CANCELLED" && (
                          <span className="text-xs text-muted-foreground">Cancelled</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
