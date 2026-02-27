import aadhaarCards from "./aadhaar_cards.json";

interface AadhaarCard {
  aadhaar_card_no: string;
  name: string;
  dob: string;
  gender: string;
  phone_number: string;
  address: string;
}

const PORT = 4000;

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/find" && req.method === "GET") {
      const adhaarno = url.searchParams.get("adhaarno");

      if (!adhaarno) {
        return Response.json(
          { error: "Please provide adhaarno query parameter" },
          { status: 400 }
        );
      }

      const normalised = adhaarno.replace(/\s/g, "");
      const result = (aadhaarCards as AadhaarCard[]).find(
        (card) => card.aadhaar_card_no.replace(/\s/g, "") === normalised
      );

      if (result) {
        return Response.json(result);
      }

      return Response.json(
        { error: "Aadhaar card not found" },
        { status: 404 }
      );
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`Mock Aadhaar server running on http://localhost:${server.port}`);