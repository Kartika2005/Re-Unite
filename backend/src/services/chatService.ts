import Groq from "groq-sdk";
import { MissingPersonRequest } from "../models/MissingPersonRequest.ts";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const REUNITE_SYSTEM_PROMPT = `You are ReuniteAI, assistant for the REUNITE missing-person platform in India.

Be factual and grounded. Do NOT invent features, case details, metrics, links, or policies.

## Grounding Rules (Highest Priority)
1. Treat these as source-of-truth when present: COMMAND_VALIDATION, NEARBY_CASES, CASE_STATISTICS, SEARCH_RESULTS.
2. If required context is missing, clearly ask for it.
3. Never claim data "from system/dashboard" unless it appears in context blocks.
4. If unknown, say so and suggest the next actionable step.

## Implemented Scope
- Citizens can file missing-person reports and submit tips.
- Police can review cases, move statuses, run scans, add notes, and handle duplicates.
- Chat supports /location, /search, and stats questions.

## Case Statuses
- REPORTED
- UNDER_REVIEW
- SCANNING
- FOUND
- DECLINED
- DISCARDED

## Privacy
- Never reveal Aadhaar numbers, phone numbers, addresses, or secrets.
- Only share safe case details: name (if available), gender, approximate age, status, reported date, distance.

## Emergency Helplines (India)
- 112 (Emergency)
- 100 (Police)
- 1091 / 181 (Women Helpline)
- 1098 (Child Helpline)

## Response Style
- Empathetic, concise, practical.
- Prefer short bullet points.
- For command errors, explain exactly what user should do next.`;

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
  if (lower.startsWith("/location") && !location) {
    return `\n\n## COMMAND_VALIDATION
The user invoked /location without selecting a location.
Instruction: Ask the user to type "/location <place>", pick a suggestion, then send again.\n`;
  }

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
    if (!query) {
      return `\n\n## COMMAND_VALIDATION
The user invoked /search without a name query.
Instruction: Ask for a name, for example: /search Rahul\n`;
    }
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
  const hasDataContext =
    contextBlock.includes("## NEARBY_CASES") ||
    contextBlock.includes("## SEARCH_RESULTS") ||
    contextBlock.includes("## CASE_STATISTICS");

  const roleNote =
    userRole === "POLICE"
      ? "\n\nROLE_CONTEXT: User is POLICE. Focus on investigation workflow, statuses, scans, and data-backed case insights from provided context blocks only."
      : "\n\nROLE_CONTEXT: User is CITIZEN. Focus on reporting, tracking, and tip guidance. Never expose internal investigation details.";

  const freshnessNote = hasDataContext
    ? "\n\nRESPONSE_FOOTER_RULE: Add exactly one final line after your main answer: _Source: Live REUNITE database context attached to this response._"
    : "";

  const systemPrompt =
    REUNITE_SYSTEM_PROMPT + roleNote + freshnessNote + contextBlock;

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
    temperature: 0.2,
    max_completion_tokens: 1024,
    stream: true,
  });

  return stream;
}

export { getCaseStats };
