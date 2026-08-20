// ============================================================================
// 1. DNS CONFIGURATION
// ============================================================================
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ============================================================================
// 2. DYNAMIC MODEL AUTO-SELECTION
// ============================================================================
let activeGroqModel = 'openai/gpt-oss-20b';

async function initializeGroqModel() {
  try {
    const modelList = await groq.models.list();
    const availableIds = modelList.data.map(m => m.id);

    const preferredOrder = [
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'openai/gpt-oss-120b',
      'groq/compound-mini',
      'allam-2-7b'
    ];

    const matched = preferredOrder.find(id => availableIds.includes(id));
    activeGroqModel = matched || 'openai/gpt-oss-20b';

    console.log(`[NovaDesk AI Ready] Active Model: "${activeGroqModel}"`);
  } catch (err) {
    console.error('Warning: Could not initialize Groq models:', err.message);
  }
}

// ============================================================================
// 3. SECURITY & STATIC ASSET MIDDLEWARES
// ============================================================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/api/', limiter);

// ============================================================================
// 4. MONGODB SCHEMAS & MODELS
// ============================================================================
const clientSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, index: true },
  businessName: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  allowedDomains: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
const Client = mongoose.model('Client', clientSchema);

const messageSchema = new mongoose.Schema({
  clientId: { type: String, default: 'default_client', index: true },
  sessionId: { type: String, required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// ============================================================================
// 5. REST API ROUTES
// ============================================================================

// Chat Route: Smart Grounded SSE Streaming
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, clientId = 'default_client', pageContext } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    let clientKnowledge = '';
    try {
      const clientData = await Client.findOne({ clientId }).lean();
      if (clientData?.systemPrompt) clientKnowledge = clientData.systemPrompt;
    } catch (e) {}

    const pageTitle = pageContext?.title || 'Current Webpage';
    const pageUrl = pageContext?.url || '';
    const pageContent = pageContext?.content || clientKnowledge || 'No specific text context found.';

    // Updated Smart Guardrail System Prompt
    const systemPrompt = `You are NovaDesk AI, an official customer support assistant grounded directly in the content of the webpage: "${pageTitle}" (${pageUrl}).

=== HOST WEBPAGE CONTEXT START ===
${pageContent}
=== HOST WEBPAGE CONTEXT END ===

${clientKnowledge ? `=== CLIENT BUSINESS RULES ===\n${clientKnowledge}\n` : ''}

CRITICAL RULES:
1. STRICT GROUNDING: Answer questions based strictly on facts present in the "HOST WEBPAGE CONTEXT" or "CLIENT BUSINESS RULES" above.
2. MISSING DETAILS ON TOPIC: If the user asks about a subject or person mentioned on this page, but the specific requested detail is not provided in the text (e.g. party affiliation, private backstory), clearly explain that the webpage does not contain that specific detail.
3. OUT-OF-SCOPE REFUSAL: If the question is completely unrelated to the webpage context (e.g. coding help, unrelated celebrities, general trivia), strictly respond with:
"I am not sure how to answer that. I can only assist with information related to this website."
4. NO HALLUCINATION: Never fabricate facts outside the provided context. Keep all valid replies concise, polite, and accurate.`;

    await Message.create({ clientId, sessionId, role: 'user', content: message });

    const history = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const formattedHistory = history.reverse().map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await groq.chat.completions.create({
      model: activeGroqModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory
      ],
      temperature: 0.15,
      stream: true
    });

    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
      }
    }

    if (fullResponse.trim()) {
      await Message.create({ clientId, sessionId, role: 'assistant', content: fullResponse });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Groq Execution Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'LLM Generation Error' })}\n\n`);
    res.end();
  }
});

// Admin Telemetry API
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const uniqueSessions = await Message.distinct('sessionId');
    const totalClients = await Client.countDocuments();
    const recentMessages = await Message.find().sort({ createdAt: -1 }).limit(15).lean();

    res.json({
      totalMessages,
      totalSessions: uniqueSessions.length,
      totalClients,
      activeModel: activeGroqModel,
      recentMessages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});

// ============================================================================
// 6. DATABASE STARTUP
// ============================================================================
const ATLAS_URI = 'mongodb+srv://nishchayanother1_db_user:O78ovCYPFUDbAciZ@cluster0.bxudiqn.mongodb.net/novaDesk?appName=Cluster0';
const MONGO_URI = process.env.MONGO_URI || ATLAS_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB Atlas Connected Successfully!');
    await initializeGroqModel();
    app.listen(process.env.PORT || 5000, () => {
      console.log(`NovaDesk Server running on http://localhost:${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('DB Connection Failed:', err));