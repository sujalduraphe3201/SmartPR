import "dotenv/config";
import express, { type Request, type Response } from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

function verifySignature(req: Request, res: Response, buf: Buffer) {
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
}

app.use(express.json({ verify: verifySignature }));

app.get("/", (req, res) => {
  res.send("AI Code Reviewer is running ✅");
});

app.post("/webhook", async (req, res) => {
  const { data } = req.body;

  // Only handle PR opened or updated (new commits)
  if (data.action !== "opened" && data.action !== "synchronize") {
    return res.status(200).send("Event ignored");
  }

  const diffUrl = data.pull_request.diff_url;
  const commentsUrl = data.pull_request.comments_url;

  try {
    // 1️⃣ Get diff text from GitHub
    const diffRes = await axios.get(diffUrl, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.diff",
      },
    });

    const diff = diffRes.data;

    // 2️⃣ Send diff to AI model
    const prompt = `
You are an expert code reviewer.
Analyze the following code diff and point out possible issues, bugs, or improvements.
If everything looks fine, say "Looks good to me!"

\`\`\`diff
${diff}
\`\`\`
`;

    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.LLM_API_KEY}`;

    const aiRes = await axios.post(aiUrl, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const review =
      aiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No feedback from AI.";

    // 3️⃣ Post AI review back to GitHub
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

    console.log("✅ AI review posted!");
    res.status(200).send("Review posted");
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.response) console.error("Response:", err.response.data);
    res.status(500).send("Error processing webhook");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
