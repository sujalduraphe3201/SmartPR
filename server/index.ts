import "dotenv/config"; // Loads .env file contents into process.env
// AFTER
import express, { type Request, type Response } from "express";
import axios from "axios";
// Note: We'll add crypto for webhook verification
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Webhook Verification Middleware ---
// This is crucial for security. It verifies that the webhook is *really* from GitHub.
const verifyGitHubSignature = (req: Request, res: Response, buf: Buffer) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    throw new Error("No signature found on request");
  }

  const hmac = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET!);
  const digest = "sha256=" + hmac.update(buf).digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature as string)
    )
  ) {
    throw new Error("Invalid signature");
  }
};

// We use express.raw to get the raw body, which we need for signature verification
app.use(express.json({ verify: verifyGitHubSignature }));

// --- Routes ---

// A simple "health check" route
app.get("/", (req: Request, res: Response) => {
  res.send("CodeGuardian AI (TS) is alive!");
});

// The main webhook handler
app.post("/webhook", async (req: Request, res: Response) => {
  // We use `any` for the payload for simplicity.
  // For a production app, you would install and use types from:
  // @octokit/webhooks-types (e.g., PullRequestEvent)
  const payload: any = req.body;

  // We only care about new Pull Requests or PRs that have new code pushed
  if (payload.action !== "opened" && payload.action !== "synchronize") {
    return res.status(200).send("Ignoring event");
  }

  console.log("Valid PR event received. Fetching diff...");

  // URLs we need from the GitHub payload
  const diff_url: string = payload.pull_request.diff_url;
  const comments_url: string = payload.pull_request.comments_url;

  try {
    // ----------------------------------------------------
    // STEP 1: Get the PR Diff from GitHub
    // ----------------------------------------------------
    const diffResponse = await axios.get(diff_url, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3.diff",
      },
    });
    const diff: string = diffResponse.data;

    console.log("Diff fetched. Analyzing with AI...");

    // ----------------------------------------------------
    // STEP 2: Send the Diff to the AI for Analysis
    // ----------------------------------------------------
    const prompt = `
      You are an expert code reviewer. Analyze the following code diff from a pull request.
      Provide a brief, high-level summary of your findings in markdown format.
      Focus on potential bugs, security issues, and best practices.
      If there are no issues, just say "Looks good to me!".

      Here is the diff:
      \`\`\`diff
      ${diff}
      \`\`\`
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.LLM_API_KEY}`;

    const aiResponse = await axios.post(geminiUrl, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });

    const reviewBody = aiResponse.data.candidates[0].content.parts[0].text;
    console.log("AI analysis complete. Posting comment...");

    // ----------------------------------------------------
    // STEP 3: Post the AI's Review back to GitHub
    // ----------------------------------------------------
    await axios.post(
      comments_url,
      {
        body: `### 🤖 CodeGuardian AI Review (TS)\n\n${reviewBody}`,
      },
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log("Comment posted successfully!");
    res.status(200).send("Review complete");
  } catch (error: any) {
    // Catch block with 'any' type for the error
    console.error("Error processing webhook:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    // Send a 500 status to GitHub so it knows the webhook failed
    res.status(500).send("Error processing event");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
