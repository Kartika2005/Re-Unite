import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

/**
 * Transcribe an audio buffer using Groq Whisper.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Groq expects a File-like object
  const ext = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "wav";

  const file = new File([new Uint8Array(audioBuffer)], `recording.${ext}`, {
    type: mimeType,
  });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    language: "en",
    temperature: 0,
  });

  return transcription.text;
}

/** Fields we extract from voice for the manual form */
export interface ManualFormFields {
  name: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  bloodGroup: string | null;
}

/** Fields we extract from voice for the Aadhaar form */
export interface AadhaarFormFields {
  aadhaarNo: string | null;
  bloodGroup: string | null;
}

/**
 * Parse a spoken transcript into structured form fields using Groq Chat + JSON mode.
 */
export async function parseManualFormFields(
  transcript: string
): Promise<ManualFormFields> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a form-filling assistant for a missing person report. 
Extract the following fields from the user's spoken description and return them as JSON.
- name: The missing person's full name (string or null)
- gender: Exactly one of "Male", "Female", or "Other" (string or null)
- dateOfBirth: Date of birth in YYYY-MM-DD format (string or null). Parse natural dates like "5th March 1990" into "1990-03-05".
- bloodGroup: Blood group — one of "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-" (string or null). Recognize spoken forms like "B positive" as "B+", "O negative" as "O-", "AB positive" as "AB+", etc.

If a field is not mentioned, return null for that field. Return ONLY valid JSON, nothing else.`,
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_completion_tokens: 256,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content || "{}");
  return {
    name: raw.name || null,
    gender: raw.gender || null,
    dateOfBirth: raw.dateOfBirth || null,
    bloodGroup: raw.bloodGroup || null,
  };
}

export async function parseAadhaarFormFields(
  transcript: string
): Promise<AadhaarFormFields> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a form-filling assistant for a missing person report filed using Aadhaar.
Extract the following fields from the user's spoken description and return them as JSON.
- aadhaarNo: The 12-digit Aadhaar number (string or null). Remove spaces. People may say digits with or without spaces.
- bloodGroup: Blood group — one of "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-" (string or null). Recognize spoken forms like "B positive" as "B+", "O negative" as "O-", etc.

If a field is not mentioned, return null for that field. Return ONLY valid JSON, nothing else.`,
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_completion_tokens: 128,
  });

  const raw = JSON.parse(response.choices[0]?.message?.content || "{}");
  return {
    aadhaarNo: raw.aadhaarNo || null,
    bloodGroup: raw.bloodGroup || null,
  };
}
