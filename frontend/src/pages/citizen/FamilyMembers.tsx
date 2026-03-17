import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api";
import type {
  AssociatedFamilyMember,
  CreateFamilyMemberPayload,
} from "../../types";
import { useAuth } from "../../context/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  Radio,
  CheckCircle2,
  Users,
  Loader2,
  Dot,
} from "lucide-react";

const RELATIONS = [
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Spouse",
  "Son",
  "Daughter",
  "Grandparent",
  "Other",
];

export function FamilyMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<AssociatedFamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateFamilyMemberPayload>({
    fullName: "",
    relation: "",
    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
    emergencyContact: "",
    rfidTagId: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [activatingRfid, setActivatingRfid] = useState(false);
  const [rfidListening, setRfidListening] = useState(false);

  useEffect(() => {
    api
      .getFamilyMembers()
      .then(setMembers)
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load family members",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleActivateRfid = async () => {
    setError("");
    setActivatingRfid(true);
    try {
      setRfidListening(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to activate RFID capture",
      );
    } finally {
      setActivatingRfid(false);
    }
  };

  useEffect(() => {
    if (!rfidListening || !user?._id) return;

    const intervalId = setInterval(async () => {
      try {
        const resp = await api.getLatestDeviceRfidTap(user._id);
        if (resp.rfidTagId) {
          setForm((prev) => ({ ...prev, rfidTagId: resp.rfidTagId || "" }));
          setRfidListening(false);
        }
      } catch {
        // Keep polling while listen mode is active.
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [rfidListening, user?._id]);

  const resetForm = () => {
    setForm({
      fullName: "",
      relation: "",
      gender: "",
      dateOfBirth: "",
      bloodGroup: "",
      emergencyContact: "",
      rfidTagId: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !form.fullName.trim() ||
      !form.relation.trim() ||
      !form.rfidTagId.trim()
    ) {
      setError("Full name, relation, and RFID tag are required");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const created = await api.createFamilyMember({
        ...form,
        fullName: form.fullName.trim(),
        relation: form.relation.trim(),
        gender: form.gender?.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        bloodGroup: form.bloodGroup?.trim() || undefined,
        emergencyContact: form.emergencyContact?.trim() || undefined,
        rfidTagId: form.rfidTagId.trim(),
        notes: form.notes?.trim() || undefined,
      });

      setMembers((prev) => [created, ...prev]);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register family member",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Tabs defaultValue="add" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full sm:w-105">
          <TabsTrigger value="add" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Add New Family Member
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <Users className="h-4 w-4" /> Registered Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Family Member Registration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Relation *</Label>
                    <Input
                      list="relation-options"
                      value={form.relation}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          relation: e.target.value,
                        }))
                      }
                      placeholder="e.g. Father"
                      required
                    />
                    <datalist id="relation-options">
                      {RELATIONS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Input
                      value={form.gender}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, gender: e.target.value }))
                      }
                      placeholder="Male / Female / Other"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dateOfBirth: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Blood Group</Label>
                    <Input
                      value={form.bloodGroup}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          bloodGroup: e.target.value,
                        }))
                      }
                      placeholder="A+, B-, O+, AB+"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Emergency Contact</Label>
                    <Input
                      value={form.emergencyContact}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          emergencyContact: e.target.value,
                        }))
                      }
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Label className="flex items-center gap-2">
                      <Radio className="h-4 w-4" /> RFID Tag ID *
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleActivateRfid}
                      disabled={activatingRfid || rfidListening}
                    >
                      {activatingRfid ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : null}
                      {rfidListening
                        ? "Waiting For RFID Tap..."
                        : "Activate RFID Field"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {rfidListening ? (
                      <Dot className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Dot className="h-4 w-4 text-muted-foreground" />
                    )}
                    Device should post tap to route with this citizenId:{" "}
                    {user?._id || "N/A"}
                  </p>

                  <Input
                    value={form.rfidTagId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        rfidTagId: e.target.value,
                      }))
                    }
                    placeholder="Captured RFID appears here"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                    placeholder="Any important notes"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  Register Family Member
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Associated Family Members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && (
                <>
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </>
              )}

              {!loading && members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No associated family members registered yet.
                </p>
              )}

              {!loading &&
                members.map((m) => (
                  <div key={m._id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{m.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.relation}
                          {m.gender ? ` · ${m.gender}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">{m.rfidTagId}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                      {m.dateOfBirth && (
                        <span>
                          DOB: {new Date(m.dateOfBirth).toLocaleDateString()}
                        </span>
                      )}
                      {m.bloodGroup && <span>Blood: {m.bloodGroup}</span>}
                      {m.emergencyContact && (
                        <span>Contact: {m.emergencyContact}</span>
                      )}
                    </div>
                    {m.notes && <p className="text-sm mt-2">{m.notes}</p>}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
