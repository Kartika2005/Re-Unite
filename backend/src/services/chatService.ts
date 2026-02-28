import Groq from "groq-sdk";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const REUNITE_SYSTEM_PROMPT = `You are ReuniteAI, an intelligent assistant for the Reunite platform — a missing persons investigation and reporting system built for India.

## About Reunite
Reunite helps find missing persons through:
- **Citizen Reporting**: Citizens file reports with photos, personal details, and last known location (manual or Aadhaar-based).
- **Police Investigation**: Officers review reports, change statuses, add investigation notes, trigger AI face recognition scans on CCTV feeds.
- **Face Recognition**: InsightFace AI scans CCTV camera feeds to find potential matches.
- **Duplicate Detection**: AI detects when the same person is reported multiple times using face embeddings + Aadhaar cross-match.
- **Public Tips**: Anyone can submit anonymous tips via shareable QR codes/links.
- **Real-time Updates**: WebSocket-powered live dashboard.
- **WhatsApp Alerts**: Automated notifications on status changes.
- **Case Map**: Visual heatmap showing missing person cases by geography.

## Case Statuses
- REPORTED — Newly filed, awaiting police review
- UNDER_REVIEW — Police is actively investigating
- SCANNING — Face recognition scan in progress
- FOUND — Person has been located ✅
- DECLINED — Report declined by police
- DISCARDED — Report discarded

## Your Capabilities
1. **Location-based case search** — When user types "/location <place>", tell them about active cases in that area using NEARBY_CASES context
2. **Case statistics** — Aggregate stats: totals, by status, resolution rate, monthly trends
3. **Safety advisory** — Inform about areas with high/low missing person reports
4. **Filing guidance** — Step-by-step instructions for citizens to file a report
5. **Tip submission guidance** — How to submit anonymous tips via QR/link
6. **Case search** — Search cases by name with "/search <name>"
7. **FAQ** — How Reunite works, face recognition, duplicate detection, QR posters, etc.
8. **Emergency contacts** — Indian helpline numbers
9. **Investigation advice** — General best practices for police officers

## Emergency Helpline Numbers (India)
- Police: 100
- Women Helpline: 1091 / 181
- Child Helpline: 1098
- Missing Persons (ZIPNET): 1094
- Emergency: 112

## Guidelines
- Be empathetic — missing persons cases involve real human suffering
- NEVER reveal Aadhaar numbers, phone numbers, or addresses of reporters
- When discussing cases, only share: name, gender, approximate age, last seen area, status, reported date
- Use the NEARBY_CASES / CASE_STATISTICS / SEARCH_RESULTS context blocks when provided
- Keep responses concise but helpful (under 300 words unless detail is needed)
- Use markdown: **bold**, bullet points, headers
- Use emojis sparingly for warmth
- For emergencies, always recommend calling 112 or the relevant helpline immediately
- If unsure, say so honestly`;

// ─── Haversine distance (km) ────────────────────────────
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── DB helpers ─────────────────────────────────────────
async function getNearbyCases(lat: number, lng: number, radiusKm = 15) {
  const activeCases = await MissingPersonRequest.find({
    status: { $in: ["REPORTED", "UNDER_REVIEW", "SCANNING"] },
  }).select("name gender dateOfBirth lastKnownLocation status createdAt");

  return activeCases
    .map((c) => ({
      doc: c,
      distance: haversineKm(
        lat,
        lng,
        c.lastKnownLocation.latitude,
        c.lastKnownLocation.longitude
      ),
    }))
    .filter((c) => c.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

async function getCaseStats() {
  const [total, reported, underReview, scanning, found, declined, discarded] =
    await Promise.all([
      MissingPersonRequest.countDocuments(),
      MissingPersonRequest.countDocuments({ status: "REPORTED" }),
      MissingPersonRequest.countDocuments({ status: "UNDER_REVIEW" }),
      MissingPersonRequest.countDocuments({ status: "SCANNING" }),
      MissingPersonRequest.countDocuments({ status: "FOUND" }),
      MissingPersonRequest.countDocuments({ status: "DECLINED" }),
      MissingPersonRequest.countDocuments({ status: "DISCARDED" }),
    ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonthReported, thisMonthResolved] = await Promise.all([
    MissingPersonRequest.countDocuments({ createdAt: { $gte: monthStart } }),
    MissingPersonRequest.countDocuments({
      status: "FOUND",
      updatedAt: { $gte: monthStart },
    }),
  ]);

  return {
    total,
    reported,
    underReview,
    scanning,
    found,
    declined,
    discarded,
    active: reported + underReview + scanning,
    thisMonthReported,
    thisMonthResolved,
    resolutionRate: total > 0 ? ((found / total) * 100).toFixed(1) : "0",
  };
}

async function searchCasesByName(name: string) {
  return MissingPersonRequest.find({
    name: { $regex: name, $options: "i" },
  })
    .select("name gender dateOfBirth lastKnownLocation status createdAt")
    .limit(10)
    .sort({ createdAt: -1 });
}

// ─── Build extra context based on intent ────────────────
async function buildContextBlock(
  lastMessage: string,
  location?: { latitude: number; longitude: number }
): Promise<string> {
  const lower = lastMessage.toLowerCase().trim();

  // /location command
  if (lower.startsWith("/location") && location) {
    const nearby = await getNearbyCases(location.latitude, location.longitude);
    if (nearby.length === 0) {
      return `\n\n## NEARBY_CASES\nNo active missing person cases found within 15 km of the queried location. This is reassuring!\n`;
    }
    let block = `\n\n## NEARBY_CASES (within 15 km of queried location)\n`;
    for (const [i, n] of nearby.entries()) {
      const age = n.doc.dateOfBirth
        ? `~${Math.floor((Date.now() - new Date(n.doc.dateOfBirth).getTime()) / (365.25 * 86400000))}`
        : "Unknown";
      block += `${i + 1}. **${n.doc.name || "Unidentified"}** — ${n.doc.gender || "N/A"}, Age ${age}, Status: ${n.doc.status}, Reported: ${new Date(n.doc.createdAt).toLocaleDateString()}, Distance: ${n.distance.toFixed(1)} km\n`;
    }
    return block;
  }

  // /search command
  if (lower.startsWith("/search")) {
    const query = lower.replace("/search", "").trim();
    if (!query) return "";
    const cases = await searchCasesByName(query);
    if (cases.length === 0)
      return `\n\n## SEARCH_RESULTS\nNo cases found matching "${query}".\n`;
    let block = `\n\n## SEARCH_RESULTS for "${query}"\n`;
    for (const [i, c] of cases.entries()) {
      block += `${i + 1}. **${c.name}** — ${c.gender || "N/A"}, Status: ${c.status}, Reported: ${new Date(c.createdAt).toLocaleDateString()}\n`;
    }
    return block;
  }

  // Statistics keywords
  if (
    /statistic|how many|total cases|case count|resolution rate|dashboard stats|overview/i.test(
      lower
    )
  ) {
    const s = await getCaseStats();
    return `\n\n## CASE_STATISTICS
- Total Cases: ${s.total}
- Active: ${s.active} (Reported: ${s.reported}, Under Review: ${s.underReview}, Scanning: ${s.scanning})
- Found / Resolved: ${s.found}
- Declined: ${s.declined}
- Discarded: ${s.discarded}
- This Month Reported: ${s.thisMonthReported}
- This Month Resolved: ${s.thisMonthResolved}
- Overall Resolution Rate: ${s.resolutionRate}%\n`;
  }

  // Auto-detect name search (e.g. "find Priya", "where is Rahul", or just a person name)
  const nameMatch = lower.match(
    /(?:find|search|look(?:ing)?\s*(?:for)?|where\s*is|any\s*(?:info|update|case)\s*(?:on|about|for)?)\s+(.{2,})/i
  );
  if (nameMatch) {
    const name = (nameMatch[1] || "").replace(/[?.!]/g, "").trim();
    if (name.length >= 2) {
      const cases = await searchCasesByName(name);
      if (cases.length > 0) {
        let block = `\n\n## SEARCH_RESULTS for "${name}"\n`;
        for (const [i, c] of cases.entries()) {
          block += `${i + 1}. **${c.name}** — ${c.gender || "N/A"}, Status: ${c.status}, Reported: ${new Date(c.createdAt).toLocaleDateString()}\n`;
        }
        return block;
      }
    }
  }

  return "";
}

// ─── Main chat handler (streaming) ──────────────────────
export async function streamChat(
  messages: { role: string; content: string }[],
  userRole: string,
  location?: { latitude: number; longitude: number }
) {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const contextBlock = await buildContextBlock(lastMessage, location);

  const roleNote =
    userRole === "POLICE"
      ? "\n\nThe current user is a POLICE OFFICER. They have access to all cases and investigation tools. You can discuss case details, strategies, and system features in depth."
      : "\n\nThe current user is a CITIZEN. They can file reports and submit tips. Do NOT reveal sensitive details about cases or investigations. Guide them through citizen-facing features.";

  const systemPrompt = REUNITE_SYSTEM_PROMPT + roleNote + contextBlock;

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
    temperature: 0.6,
    max_completion_tokens: 1024,
    stream: true,
  });

  return stream;
}

export { getCaseStats };
