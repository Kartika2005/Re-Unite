const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || "https://gate.whapi.cloud";
const WHATSAPP_AUTH_TOKEN = process.env.WHATSAPP_AUTH_TOKEN || "";
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY || "";

interface CaseInfo {
  name?: string;
  aadhaarNo?: string;
  gender?: string;
  dateOfBirth?: Date;
  lastKnownLocation?: { latitude: number; longitude: number };
  photoUrl?: string;
  status: string;
  caseId: string;
}

function formatDate(d?: Date): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!GEOAPIFY_KEY) return null;
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_KEY}`
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.features?.[0]?.properties?.formatted || null;
  } catch {
    return null;
  }
}

async function buildCaption(info: CaseInfo): Promise<string | null> {
  const label = info.name || info.aadhaarNo || info.caseId;
  const tipLink = `${FRONTEND_URL}/tip/${info.caseId}`;

  // Reverse geocode the location
  let locationLine: string | null = null;
  let mapsLine: string | null = null;
  if (info.lastKnownLocation) {
    const { latitude, longitude } = info.lastKnownLocation;
    const placeName = await reverseGeocode(latitude, longitude);
    const mapsUrl = googleMapsUrl(latitude, longitude);
    locationLine = `📍 *Last Known Location:* ${placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`;
    mapsLine = `🗺️ *Google Maps:* ${mapsUrl}`;
  }

  const details = [
    info.gender ? `👤 *Gender:* ${info.gender}` : null,
    info.dateOfBirth
      ? `🎂 *Date of Birth:* ${formatDate(info.dateOfBirth)}`
      : null,
    locationLine,
    mapsLine,
  ]
    .filter(Boolean)
    .join("\n");

  switch (info.status) {
    case "UNDER_REVIEW":
      return [
        `🔍 *Case Under Review*`,
        ``,
        `A missing person report for *${label}* is now being reviewed by the authorities.`,
        ``,
        `📋 *Case ID:* ${info.caseId}`,
        `⏳ *Status:* Under Review`,
        details ? `\n${details}` : null,
        ``,
        `🔗 *Submit a Tip:* ${tipLink}`,
        ``,
        `If you have any information, please submit a tip using the link above. Every detail counts! 🙏`,
      ]
        .filter((l) => l !== null)
        .join("\n");

    case "FOUND":
      return [
        `🎉🎊 *Person Found!* 🎊🎉`,
        ``,
        `Great news! *${label}* has been found! ✅`,
        ``,
        `📋 *Case ID:* ${info.caseId}`,
        `✅ *Status:* Found`,
        details ? `\n${details}` : null,
        ``,
        `Thank you to everyone who helped in the search. Together we reunite families! 💚`,
      ]
        .filter((l) => l !== null)
        .join("\n");

    case "DECLINED":
      return [
        `❌ *Case Declined*`,
        ``,
        `The missing person report for *${label}* has been declined by the reviewing officer.`,
        ``,
        `📋 *Case ID:* ${info.caseId}`,
        `🚫 *Status:* Declined`,
        details ? `\n${details}` : null,
        ``,
        `If you believe this is an error, please file a new report with additional details. 📝`,
      ]
        .filter((l) => l !== null)
        .join("\n");

    default:
      return null;
  }
}

export async function sendWhatsAppNotification(info: CaseInfo): Promise<void> {
  if (!WHATSAPP_AUTH_TOKEN || !WHATSAPP_RECIPIENT) {
    console.warn(
      "⚠️  WhatsApp credentials not configured — skipping notification"
    );
    return;
  }

  const caption = await buildCaption(info);
  if (!caption) return;

  try {
    // If we have a photo, send as image with caption; otherwise plain text
    const hasPhoto = !!info.photoUrl;
    const endpoint = hasPhoto
      ? `${WHATSAPP_API_URL}/messages/image`
      : `${WHATSAPP_API_URL}/messages/text`;

    const payload = hasPhoto
      ? {
          to: WHATSAPP_RECIPIENT,
          media: info.photoUrl,
          caption,
        }
      : {
          typing_time: 0,
          to: WHATSAPP_RECIPIENT,
          body: caption,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`WhatsApp API error (${res.status}):`, text);
    } else {
      console.log(
        `✅ WhatsApp notification sent for case ${info.caseId} (${hasPhoto ? "image" : "text"})`
      );
    }
  } catch (err) {
    console.error("Failed to send WhatsApp notification:", err);
  }
}

// ─── Duplicate alert WhatsApp notification ─────────────────
interface DuplicateInfo {
  newCaseId: string;
  newName?: string;
  newPhotoUrl?: string;
  existingCaseId: string;
  existingName?: string;
  score: number;
  matchType: string;
}

export async function sendDuplicateWhatsApp(
  info: DuplicateInfo
): Promise<void> {
  if (!WHATSAPP_AUTH_TOKEN || !WHATSAPP_RECIPIENT) return;

  const pct = Math.round(info.score * 100);
  const newLabel = info.newName || info.newCaseId;
  const existingLabel = info.existingName || info.existingCaseId;
  const matchLabel =
    info.matchType === "BOTH"
      ? "Face + Aadhaar"
      : info.matchType === "AADHAAR"
        ? "Aadhaar Number"
        : "Face Recognition";

  const body = [
    `🚨 *DUPLICATE CASE ALERT* 🚨`,
    ``,
    `A newly filed report may be a duplicate of an existing active case.`,
    ``,
    `📋 *New Case:* ${newLabel}`,
    `🔗 *Existing Case:* ${existingLabel}`,
    `📊 *Similarity:* ${pct}%`,
    `🔍 *Match Type:* ${matchLabel}`,
    ``,
    `⚠️ *Severity: CRITICAL* — Immediate review recommended.`,
    ``,
    `Open the Police Dashboard to review and take action. 👮`,
  ].join("\n");

  try {
    const hasPhoto = !!info.newPhotoUrl;
    const endpoint = hasPhoto
      ? `${WHATSAPP_API_URL}/messages/image`
      : `${WHATSAPP_API_URL}/messages/text`;

    const payload = hasPhoto
      ? { to: WHATSAPP_RECIPIENT, media: info.newPhotoUrl, caption: body }
      : { typing_time: 0, to: WHATSAPP_RECIPIENT, body };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`WhatsApp duplicate alert error (${res.status}):`, await res.text());
    } else {
      console.log(`✅ WhatsApp duplicate alert sent for case ${info.newCaseId}`);
    }
  } catch (err) {
    console.error("Failed to send duplicate WhatsApp:", err);
  }
}
