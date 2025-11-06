# SmartPR – AI-Powered Pull Request Reviewer

**SmartPR** is an AI-powered GitHub Pull Request reviewer built with **Node.js**, **Express**, and **Google Gemini**.  
It automatically analyzes code changes, detects bugs, and posts concise, helpful feedback directly on your GitHub PRs.

---

## Features

-  Reviews pull request diffs in real time  
-  Uses **Gemini AI** for intelligent code analysis  
-  Posts structured review comments on GitHub  
-  Verifies GitHub webhook signatures (secure)  
-  Lightweight Express server in TypeScript  

---

## How It Works

1. A developer opens or updates a **Pull Request**  
2. **GitHub Webhook** triggers the SmartPR server  
3. SmartPR:
   - Fetches the PR’s diff from GitHub  
   - Sends it to **Gemini AI** for review  
   - Posts AI-generated feedback back to the PR as a comment  
