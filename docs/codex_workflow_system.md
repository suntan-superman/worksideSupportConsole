# Codex Workflow System — Workside Engineering Standard

## 🎯 Purpose

This document defines how Codex is used as an engineering partner across:

- Merxus AI Backend
- Workside Support Console
- Future Workside products

Goal:
👉 Maximum speed WITHOUT instability  
👉 Deep understanding WITHOUT overload  
👉 Consistent high-quality output  

---

# 🧠 CORE PRINCIPLE

Codex is NOT a chatbot.

Codex is:

👉 a **context-aware engineering agent**

You must:

- control context
- control scope
- guide reasoning

---

# 🔁 CORE WORKFLOW LOOP

Always use:

RESEARCH → PLAN → EXECUTE → REVIEW

---

## 1. RESEARCH

Understand current system behavior.

Example:


Scan the /support module and explain:

routes
services
enforcement logic
transfer state machine

---

## 2. PLAN

Define approach BEFORE coding.


Propose a clean implementation plan for enforcing:

lead capture before close
inquiry capture before transfer

---

## 3. EXECUTE

Now implement.


Implement the enforcement logic in backend services and ensure all routes validate state transitions.


---

## 4. REVIEW

Force Codex to validate.


Review the implementation and identify:

edge cases
missing validation
possible bypass paths

---

# 📦 CONTEXT SYSTEM (CRITICAL)

## DO NOT dump entire repo

Instead use:

### Layered context:

1. Architecture (high level)
2. Module (focused)
3. File (specific)

---

## Required Files (create these)

### 1. AGENTS.md

```md
# Workside System Overview

## Architecture
- Multi-tenant system
- Backend: Node + MongoDB
- Auth: Firebase + custom claims

## Support Flow
AI → transfer → human → lead → inquiry → close

## Rules
- No reply before takeover
- No close without lead
- No transfer without inquiry
2. ARCHITECTURE.md

Describe:

services
data flow
integrations (Twilio, Firebase, Mongo)
3. AI_CONTRACT.md

Define:

API shapes
response formats
required fields
4. DECISIONS.md

Track:

why decisions were made
tradeoffs
future changes