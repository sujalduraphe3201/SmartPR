
import dotenv from "dotenv";
dotenv.config();
import express, { type Request, type Response } from "express";
import crypto, { verify } from "crypto";
import axios from "axios";
const app = express();

const verifySignature = (req: Request, res: Response, buf: Buffer) => {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.WEBHOOK_SECRET;
  if (!signature || !secret) {
    throw new Error("Missing signature or secret");
  }
  const hmac = crypto.createHmac("sha256", secret);
  const expected = "sha256=" + hmac.update(buf).digest("hex");

  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature as string),
      Buffer.from(expected)
    );

  if (!valid) throw new Error("Invalid signature");
};

app.use(express.json({ verify: verifySignature }));

app.get("/", (req, res) => {
  res.send("Main route is healthy");
});

app.post("/webhook", async (req, res) => {
  const data = req.body;

  if (data.action !== "opened" && data.action !== "synchronize") {
    console.log("Ignoring event:", data.action);
    return res.status(200).send("Event ignored");
  }

  // ✅ respond quickly so GitHub stops waiting
  res.status(200).send("Processing in background");

  const diffUrl = data.pull_request.diff_url;
  const commentsUrl = data.pull_request.comments_url;

  try {
    console.log("📄 Fetching diff...");
    const diffRes = await axios.get(diffUrl, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.diff",
      },
    });

    const diff = diffRes.data;

    console.log("🤖 Sending diff to Gemini...");
    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.LLM_API_KEY}`;

    const prompt = `
You are a senior software engineer reviewing a pull request.

Analyze the code diff below and provide concise, constructive feedback:
- Point out bugs or logic issues.
- Suggest improvements for clarity, performance, or security.
- If everything looks good, reply with: "✅ Looks good to me."

\`\`\`diff
${diff}
\`\`\`
`;

    const aiRes = await axios.post(aiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const review =
      aiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No feedback from AI.";

    console.log("💬 Posting review comment to GitHub...");
    await axios.post(
      commentsUrl,
      { body: `🤖 **AI Review:**\n${review}` },
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log("✅ Review posted!");
  } catch (err: any) {
    console.error("❌ Error during processing:", err.message);
    if (err.response) console.error("Response:", err.response.data);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening to port ${PORT}`);
});
