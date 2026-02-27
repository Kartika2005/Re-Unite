import { useState, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api";
import { LocationPicker, type LocationValue } from "../../components/LocationPicker";
import { SpeakToFill } from "../../components/SpeakToFill";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, ImageIcon, AlertCircle, Loader2, IndianRupee, UserPlus, CreditCard,
} from "lucide-react";

type ReportMode = "manual" | "aadhaar";

export function ReportMissing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ReportMode>("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [bountyAmount, setBountyAmount] = useState<string>("");

  // Manual mode fields
  const [form, setForm] = useState({
    name: "",
    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
  });

  // Aadhaar mode fields
  const [aadhaarForm, setAadhaarForm] = useState({
    aadhaarNo: "",
    bloodGroup: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!photoFile) {
      setError("Please select a photo of the missing person");
      return;
    }

    if (!location) {
      setError("Please select the last known location on the map");
      return;
    }

    setLoading(true);

    try {
      if (mode === "aadhaar") {
        const cleanAadhaar = aadhaarForm.aadhaarNo.replace(/\s/g, "");
        if (!/^\d{12}$/.test(cleanAadhaar)) {
          setError("Aadhaar number must be exactly 12 digits");
          setLoading(false);
          return;
        }
        await api.createRequest({
          aadhaarNo: aadhaarForm.aadhaarNo,
          bloodGroup: aadhaarForm.bloodGroup,
          lastKnownLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          photo: photoFile,
          bountyAmount: bountyAmount ? Number(bountyAmount) : undefined,
        });
      } else {
        await api.createRequest({
          name: form.name,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          bloodGroup: form.bloodGroup,
          lastKnownLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          photo: photoFile,
          bountyAmount: bountyAmount ? Number(bountyAmount) : undefined,
        });
      }
      navigate("/citizen/requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: ReportMode) => {
    setMode(newMode);
    setError("");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Report Missing Person</CardTitle>
          {/* Mode Tabs */}
          <div className="flex border-b mt-4">
            <button
              type="button"
              onClick={() => switchMode("manual")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 ${
                mode === "manual"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-1.5 -mt-0.5" /> Without Aadhaar
            </button>
            <button
              type="button"
              onClick={() => switchMode("aadhaar")}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 ${
                mode === "aadhaar"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <CreditCard className="h-4 w-4 inline mr-1.5 -mt-0.5" /> With Aadhaar
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "manual" ? (
              <>
                {/* Voice fill for manual mode */}
                <SpeakToFill
                  mode="manual"
                  onResult={(fields) => {
                    setForm((prev) => ({
                      ...prev,
                      ...(fields.name ? { name: fields.name } : {}),
                      ...(fields.gender ? { gender: fields.gender } : {}),
                      ...(fields.dateOfBirth ? { dateOfBirth: fields.dateOfBirth } : {}),
                      ...(fields.bloodGroup ? { bloodGroup: fields.bloodGroup } : {}),
                    }));
                  }}
                />

                {/* Manual: Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Missing person's full name"
                  />
                </div>

                {/* Manual: Gender + Blood Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Select required value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Blood Group *</Label>
                    <Select required value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Manual: DOB */}
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Voice fill for aadhaar mode */}
                <SpeakToFill
                  mode="aadhaar"
                  onResult={(fields) => {
                    setAadhaarForm((prev) => ({
                      ...prev,
                      ...(fields.aadhaarNo ? { aadhaarNo: fields.aadhaarNo } : {}),
                      ...(fields.bloodGroup ? { bloodGroup: fields.bloodGroup } : {}),
                    }));
                  }}
                />

                {/* Aadhaar: Aadhaar Number */}
                <div className="space-y-2">
                  <Label htmlFor="aadhaar">Aadhaar Number *</Label>
                  <Input
                    id="aadhaar"
                    required
                    value={aadhaarForm.aadhaarNo}
                    onChange={(e) => setAadhaarForm({ ...aadhaarForm, aadhaarNo: e.target.value })}
                    placeholder="Enter 12-digit Aadhaar number"
                    maxLength={14}
                  />
                  <p className="text-xs text-muted-foreground">
                    Name, gender, and date of birth will be fetched by the police from the Aadhaar database.
                  </p>
                </div>

                {/* Aadhaar: Blood Group */}
                <div className="space-y-2">
                  <Label>Blood Group *</Label>
                  <Select required value={aadhaarForm.bloodGroup} onValueChange={(v) => setAadhaarForm({ ...aadhaarForm, bloodGroup: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Shared: Photo */}
            <div className="space-y-2">
              <Label>Photo *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                {photoPreview ? (
                  <ImageIcon className="h-4 w-4 text-primary" />
                ) : (
                  <Upload className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={photoFile ? "text-foreground" : "text-muted-foreground"}>
                  {photoFile ? photoFile.name : "Choose an image file..."}
                </span>
              </button>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="mt-2 max-w-full max-h-52 rounded-md object-contain border"
                />
              )}
            </div>

            {/* Shared: Location */}
            <LocationPicker
              value={location || undefined}
              onChange={setLocation}
            />

            {/* Shared: Bounty */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5" /> Reward / Bounty — Optional
              </Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={bountyAmount}
                onChange={(e) => setBountyAmount(e.target.value)}
                placeholder="e.g. 5000"
              />
              <p className="text-xs text-muted-foreground">
                Pledge money as a reward for information leading to finding the person.
                You'll pay via PhonePe only after police mark the case as found.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
