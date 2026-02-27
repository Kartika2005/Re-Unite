import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface SpeakToFillProps {
  mode: "manual" | "aadhaar";
  onResult: (fields: Record<string, string | null>, transcript: string) => void;
}

export function SpeakToFill({ mode, onResult }: SpeakToFillProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError("");
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await sendAudio(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Microphone access denied"
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendAudio = async (blob: Blob) => {
    setProcessing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("mode", mode);

      const res = await fetch(`${API_BASE}/public/voice-to-form`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process voice");
      }

      const data = await res.json();
      setTranscript(data.transcript);
      onResult(data.fields, data.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice processing failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mb-4 p-3 border border-dashed border-blue-300 rounded-lg bg-blue-50/50">
      <div className="flex items-center gap-3">
        {!recording && !processing && (
          <Button type="button" onClick={startRecording} size="sm" className="gap-1.5">
            <Mic className="h-3.5 w-3.5" /> Speak to Fill
          </Button>
        )}

        {recording && (
          <Button
            type="button"
            onClick={stopRecording}
            size="sm"
            variant="destructive"
            className="gap-1.5 animate-pulse"
          >
            <Square className="h-3.5 w-3.5" /> Done
          </Button>
        )}

        {processing && (
          <span className="text-sm text-primary font-medium flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing voice…
          </span>
        )}

        {recording && (
          <span className="text-xs text-destructive flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-destructive rounded-full animate-pulse" />
            Recording… Speak now
          </span>
        )}
      </div>

      {transcript && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          <strong>Heard:</strong> "{transcript}"
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
        {mode === "manual"
          ? 'Say something like: "His name is Rahul Sharma, male, born 5th March 1990, blood group B positive"'
          : 'Say something like: "Aadhaar number 1234 5678 9012, blood group O positive"'}
      </p>
    </div>
  );
}
