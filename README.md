# NovaDesk AI ⚡

> A lightweight, zero-dependency, CSS-isolated embeddable AI customer support agent engineered with Vanilla JS (Shadow DOM), Server-Sent Events (SSE), Groq LPU inference, and DOM-level context grounding.

![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=flat-square&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-black?style=flat-square&logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-Connected-brightgreen?style=flat-square&logo=mongodb)
![Groq](https://img.shields.io/badge/Groq_LPU-Streaming_Enabled-orange?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Shadow_DOM-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 🏗️ Architecture & Data Flow

NovaDesk AI avoids bloated frontend client bundles (React/Vue) and prevents host-site CSS bleeding using native Web Components. It streams answers directly from Groq's high-speed inference engine while grounding responses strictly on the host webpage DOM.

+-------------------------------------------------------------------------+
|                              HOST WEBSITE                               |
|                                                                         |
|  [ Visible DOM Context ]                                                |
|            |                                                            |
|            v                                                            |
|  [ Shadow DOM Widget ] --- (1) POST /api/chat (Query + DOM Text) -----> |
|            ^                                                            |
|            | <------------ (4) Real-Time SSE Token Stream ------------- |
+------------|------------------------------------------------------------+
|                                              |
|                                              v
+------------|------------------------------------------------------------+
|            |                     EXPRESS BACKEND                        |
|            |                                                            |
|            |        (2) System Prompt Injection & Grounding Filter      |
|            |        (3) Groq LPU Auto-Fallback Pipeline                 |
|            |                         |                                  |
|            |                         v                                  |
|            |                 [ Groq API Engine ]                        |
|            |                                                            |
|            +-------- [ MongoDB Atlas Telemetry & Session Store ]        |
+-------------------------------------------------------------------------+


## ✨ Engineering Highlights

* **100% Style Isolation (Shadow DOM):** Encapsulates widget styles entirely inside an open-mode Shadow Root, eliminating stylesheet bleeding and specificity clashes on third-party host sites.
* **Low-Latency Streaming via SSE:** Implements unidirectional Server-Sent Events over HTTP with custom line-buffering to prevent token fragmentation during chunk rendering.
* **Context Grounding & Guardrails:** Dynamically extracts `document.body.innerText` on runtime, enforcing strict few-shot system prompt boundaries to restrict responses to host-page data and prevent hallucinations.
* **Dynamic Model Auto-Fallback:** Queries the Groq Models API at startup to dynamically select the best available model (`gpt-oss-20b`, `qwen3.6-27b`, etc.), guaranteeing runtime stability.
* **Multi-Tenant Configuration:** Supports custom branding, colors, bot names, and tenant knowledge bases via `data-*` script attributes.
* **Security & Production Hardening:** Built with Helmet (cross-origin resource policy), rate-limiting middleware (`express-rate-limit`), and input validation.
* **Live Telemetry Dashboard:** Includes an internal administrative view to monitor active LLM models, message volume, and active user sessions in real time.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database & Persistence:** MongoDB Atlas, Mongoose
* **Inference Engine:** Groq SDK (LPU accelerated token streaming)
* **Frontend Integration:** Vanilla JavaScript (ES6+), Shadow DOM, Native SVG icons
* **Security & Optimization:** Helmet.js, Express Rate Limit, CORS, Server-Sent Events

---

## 📂 Project Structure


NovaDeskAi/
├── .env                       # Environment credentials (PORT, GROQ_API_KEY, MONGO_URI)
├── .gitignore                 # Excluded dependencies & sensitive files
├── package.json               # Project metadata, dependencies & scripts
├── README.md                  # Comprehensive system documentation
├── server.js                  # Express backend, Groq SSE streaming pipeline & DB models
└── public/
    ├── widget.js              # Standalone embeddable script (Shadow DOM + Scraper)
    ├── index.html             # Client-side demo playground
    └── admin.html             # Real-time telemetry & session analytics portal


🚀 Quickstart & Local Setup1. Clone the RepositoryBashgit clone [https://github.com/NishChay725/NovaDesk-Chat-Bot.git](https://github.com/NishChay725/NovaDesk-Chat-Bot.git)
cd NovaDesk-Chat-Bot
2. Install DependenciesBashnpm install
3. Setup Environment VariablesCreate a .env file in the root directory:Code snippetPORT=5000
GROQ_API_KEY=your_groq_api_key_here
MONGO_URI=your_mongodb_connection_string
4. Run the ServerBashnpm start
The server will initialize at http://localhost:5000.💻 Embed IntegrationIntegrate the widget into any web application by adding this single script tag before the closing </body> tag:HTML<script 
  src="http://localhost:5000/widget.js" 
  data-api-url="http://localhost:5000"
  data-bot-name="Support AI" 
  data-color="#2563eb" 
  data-client-id="client_001"
  defer>
</script>
Configuration ParametersAttributeTypeDefaultDescriptiondata-api-urlStringhttp://localhost:5000Target backend host URL.data-bot-nameStringNovaDesk AIDisplay name rendered in the chat header.data-colorHex String#2563ebPrimary accent color for UI triggers & bubbles.data-client-idStringdefault_clientMulti-tenant tenant identifier for custom system prompts.📡 API Specification1. Chat Completion StreamRoute: POST /api/chatContent-Type: application/jsonResponse: text/event-stream (Server-Sent Events)JSON{
  "sessionId": "sess_482910fa",
  "message": "What is the return policy?",
  "clientId": "client_001",
  "pageContext": {
    "title": "Return Policy | Store",
    "url": "[https://example.com/returns](https://example.com/returns)",
    "content": "Raw extracted innerText from host DOM..."
  }
}
2. Telemetry MetricsRoute: GET /api/admin/statsResponse: Returns real-time aggregate message counts, active sessions, and raw message logs.
