import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api";
import { LocationPicker } from "../components/LocationPicker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  CheckCircle,
  AlertCircle,
  Trophy,
  MapPin,
  Loader2,
} from "lucide-react";

export function TipPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [caseData, setCaseData] = useState<api.PublicCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [message, setMessage] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [includeLocation, setIncludeLocation] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    api
      .getPublicCaseById(caseId)
      .then(setCaseData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load case")
      )
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseId || !message.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.submitTip(caseId, {
        message: message.trim(),
        location: includeLocation && location ? location : undefined,
        contactInfo: contactInfo.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit tip");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Skeleton className="h-8 w-48 mx-auto mb-4" />
        <Skeleton className="h-32 w-full rounded-xl mb-4" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );

  if (!caseData)
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
        <p className="text-destructive font-medium">{error || "Case not found."}</p>
      </div>
    );

  if (submitted)
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <Card>
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="h-14 w-14 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your tip has been submitted and will be reviewed by the investigating
              team. Every bit of information helps bring someone home.
            </p>
          </CardContent>
        </Card>
      </div>
    );

  const c = caseData.case;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2">
          <Search className="h-5 w-5" /> Submit a Tip
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Help us find this missing person. All tips are anonymous unless you provide contact info.
        </p>
      </div>

      {/* Case card */}
      <Card>
        <CardContent className="pt-5 flex gap-4">
          <img
            src={c.photoUrl}
            alt={c.name || "Missing person"}
            className="w-24 h-24 rounded-lg object-cover bg-muted shrink-0"
          />
          <div className="text-sm space-y-1">
            <h3 className="font-semibold text-base">{c.name || "Unidentified Person"}</h3>
            {c.gender && <p className="text-muted-foreground">Gender: {c.gender}</p>}
            {c.bloodGroup && <p className="text-muted-foreground">Blood Group: {c.bloodGroup}</p>}
            <p className="text-muted-foreground">Reported: {new Date(c.createdAt).toLocaleDateString()}</p>
            <Badge
              variant="secondary"
              className={
                c.status === "FOUND"
                  ? "bg-green-100 text-green-700"
                  : c.status === "DECLINED"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
              }
            >
              {c.status.replace("_", " ")}
            </Badge>
            {caseData.tipCount > 0 && (
              <p className="text-xs text-sky-600 mt-1">
                {caseData.tipCount} tip{caseData.tipCount !== 1 ? "s" : ""} received so far
              </p>
            )}
            {caseData.bountyAmount > 0 && (
              <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-300 gap-1">
                <Trophy className="h-3 w-3" /> Bounty: ₹{caseData.bountyAmount.toLocaleString()}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {caseData.resolved ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            This case has been resolved and is no longer accepting tips.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Tip</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>What did you see? *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. I saw someone matching this description near the railway station around 3 PM today..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLocation}
                    onChange={(e) => setIncludeLocation(e.target.checked)}
                    className="rounded border-input"
                  />
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Include sighting location on map
                </label>
                {includeLocation && (
                  <div className="mt-2">
                    <LocationPicker
                      value={
                        location
                          ? {
                              latitude: location.latitude,
                              longitude: location.longitude,
                              displayName: "",
                            }
                          : undefined
                      }
                      onChange={(val) =>
                        setLocation(
                          val
                            ? { latitude: val.latitude, longitude: val.longitude }
                            : null
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Contact info (optional)</Label>
                <Input
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Phone or email — only visible to investigators"
                />
                <p className="text-xs text-muted-foreground">
                  Only shared with the investigating police team
                </p>
              </div>

              <Button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Tip"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
