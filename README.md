#  SmartPR – AI-Powered Code Review Assistant

SmartPR is an intelligent automation tool that reviews GitHub Pull Requests using AI.  
It fetches PR diffs, analyzes the code using a Large Language Model (LLM), and comments directly on the PR with feedback, just like a human code reviewer.

---

##  Features

✔ Automatically triggers on PR creation or update  
✔ Fetches and analyzes the code diff  
✔ AI-generated review with recommendations  
✔ Posts smart comments directly to the PR  
✔ Secure webhook validation using HMAC (sha256)  
✔ Easy to integrate with any repository


---

##  How It Works

```text
Developer pushes code → GitHub PR → Webhook → SmartPR Server
         ↓
    Fetch PR diff → Send to AI → AI review → Comment on PR
