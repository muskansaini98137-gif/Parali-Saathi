
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "Parali Saathi AI Backend",
    aiConnected: Boolean(openai),
  });
});

app.post("/api/agent/chat", async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: "OpenAI key is not configured in server/.env.",
      });
    }

    const { message, language = "auto", role = "farmer" } =
      req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter a message.",
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "Message must be under 4000 characters.",
      });
    }

    const allowedRoles = ["farmer", "buyer"];
    const allowedLanguages = [
      "auto",
      "Hindi",
      "English",
      "Punjabi",
      "Haryanvi",
    ];

    const safeRole = allowedRoles.includes(role) ? role : "farmer";
    const safeLanguage = allowedLanguages.includes(language)
      ? language
      : "auto";

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: `You are Parali Saathi, a helpful crop-residue marketplace assistant in India.
The current user's role is ${safeRole}.
Preferred language: ${safeLanguage}.
Reply naturally in the user's language. Support Hindi, English, Punjabi, Haryanvi and Hinglish.
Ask one clear follow-up question at a time.
You do not have access to live listings, real prices, buyers, bookings or orders yet.
Never invent them and never claim to have saved or booked anything.
If asked to create a listing, collect details conversationally but clearly say it has not been saved yet.
Keep replies concise and beginner-friendly.`,
      input: message.trim(),
    });

    return res.json({
      success: true,
      reply:
        response.output_text ||
        "Maaf kijiye, main abhi jawab nahi bana paaya. Dobara try karein.",
    });
  } catch (error) {
    console.error("AI chat request failed:", error.message);

    return res.status(502).json({
      success: false,
      error: "AI reply abhi available nahi hai. Thodi der baad dobara try karein.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Parali Saathi backend running at http://localhost:${PORT}`);
});