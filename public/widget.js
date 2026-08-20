(function () {
  function initNovaDeskWidget() {
    // 1. Check if widget already mounted
    if (document.getElementById('novadesk-root')) return;

    // 2. Read dynamic script attributes
    const currentScript = document.currentScript || document.querySelector('script[src*="widget.js"]');
    const BACKEND_URL = currentScript?.getAttribute('data-api-url') || 'http://localhost:5000';
    const PRIMARY_COLOR = currentScript?.getAttribute('data-color') || '#2563eb';
    const BOT_NAME = currentScript?.getAttribute('data-bot-name') || 'NovaDesk AI';
    const CLIENT_ID = currentScript?.getAttribute('data-client-id') || 'default_client';

    // 3. Persistent LocalStorage Session
    let sessionId = localStorage.getItem('novadesk_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now();
      localStorage.setItem('novadesk_session_id', sessionId);
    }

    // 4. Extract Current Page Context (Title + Visible Text Content)
    function extractPageContext() {
      try {
        const title = document.title || 'Untitled Page';
        const url = window.location.href;
        
        // Page ka visible text extract karna (excess whitespace & scripts hatakar)
        const rawText = document.body ? document.body.innerText : '';
        const cleanText = rawText
          .replace(/\s+/g, ' ')
          .replace(/<[^>]*>/g, '')
          .slice(0, 4000); // Safe token limit (first 4000 characters)

        return { title, url, content: cleanText };
      } catch (e) {
        return { title: 'Unknown', url: window.location.href, content: '' };
      }
    }

    // 5. Shadow DOM Host setup
    const host = document.createElement('div');
    host.id = 'novadesk-root';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    // Supernova SVG Vector
    const supernovaStarSvg = `
      <svg class="supernova-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C12 7.075 7.075 12 1 12C7.075 12 12 16.925 12 23C12 16.925 16.925 12 23 12C16.925 12 12 7.075 12 1Z" />
        <path d="M19 1C19 2.657 17.657 4 16 4C17.657 4 19 5.343 19 7C19 5.343 20.343 4 22 4C20.343 4 19 2.657 19 1Z" opacity="0.85" />
      </svg>
    `;

    // 6. Inject Isolated CSS & HTML
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .launcher-btn {
          position: fixed; bottom: 24px; right: 24px; width: 58px; height: 58px;
          background: linear-gradient(135deg, ${PRIMARY_COLOR}, #1e1b4b); color: #ffffff;
          border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, 0.2);
          cursor: pointer; box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); display: flex;
          align-items: center; justify-content: center; z-index: 999999999;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
        }
        .launcher-btn:hover { transform: scale(1.08) rotate(6deg); box-shadow: 0 12px 30px rgba(37, 99, 235, 0.55); }
        .launcher-btn .supernova-icon { width: 26px; height: 26px; fill: #ffffff; filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)); }

        .chat-window {
          position: fixed; bottom: 96px; right: 24px; width: 390px; height: 540px;
          max-width: calc(100vw - 32px); max-height: calc(100vh - 120px);
          background: #ffffff; border-radius: 18px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
          display: none; flex-direction: column; overflow: hidden; z-index: 999999999;
          border: 1px solid #e2e8f0; animation: popIn 0.22s ease-out;
        }
        @keyframes popIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .chat-header {
          background: linear-gradient(135deg, ${PRIMARY_COLOR}, #0f172a); color: #ffffff;
          padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;
        }
        .header-brand { display: flex; align-items: center; gap: 10px; }
        .header-star-badge {
          width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 255, 255, 0.15);
          display: flex; align-items: center; justify-content: center;
        }
        .header-star-badge .supernova-icon { width: 18px; height: 18px; fill: #93c5fd; }
        .chat-title { font-weight: 600; font-size: 14.5px; }
        .chat-status { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 5px; margin-top: 1px; }
        .status-dot { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 6px #22c55e; }
        
        .header-actions { display: flex; gap: 8px; align-items: center; }
        .icon-btn {
          background: transparent; border: none; color: #94a3b8; cursor: pointer;
          font-size: 14px; padding: 4px 6px; border-radius: 6px; transition: color 0.15s;
        }
        .icon-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.12); }

        .chat-messages {
          flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #f8fafc;
        }
        .msg {
          max-width: 88%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px;
          line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word;
        }
        .msg-user { align-self: flex-end; background: ${PRIMARY_COLOR}; color: #ffffff; border-bottom-right-radius: 2px; }
        .msg-bot { align-self: flex-start; background: #ffffff; color: #1e293b; border-bottom-left-radius: 2px; border: 1px solid #e2e8f0; }
        .msg-bot strong { font-weight: 600; color: #0f172a; }

        .msg-bot code:not(pre code) {
          background: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; border: 1px solid #e2e8f0;
        }
        .msg-bot pre {
          background: #0f172a !important; color: #f8fafc !important;
          padding: 12px 14px; border-radius: 10px; margin: 8px 0;
          overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px; line-height: 1.5; border: 1px solid #1e293b; white-space: pre; word-break: normal;
        }
        .msg-bot pre code { background: transparent !important; color: #f8fafc !important; padding: 0 !important; border: none !important; }

        .chat-input-area { padding: 12px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; background: #ffffff; }
        .chat-input { flex: 1; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; outline: none; font-size: 13.5px; }
        .chat-input:focus { border-color: ${PRIMARY_COLOR}; }
        .chat-send-btn { background: ${PRIMARY_COLOR}; color: #fff; border: none; padding: 0 16px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13px; }
        .chat-send-btn:disabled { background: #94a3b8; cursor: not-allowed; }
      </style>

      <button class="launcher-btn" id="novadesk-launcher" title="Open NovaDesk AI">${supernovaStarSvg}</button>

      <div class="chat-window" id="novadesk-window">
        <div class="chat-header">
          <div class="header-brand">
            <div class="header-star-badge">${supernovaStarSvg}</div>
            <div>
              <div class="chat-title">${BOT_NAME}</div>
              <div class="chat-status"><span class="status-dot"></span> Page Assistant</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn" id="novadesk-clear" title="Reset Session">🔄</button>
            <button class="icon-btn" id="novadesk-close" title="Close">✕</button>
          </div>
        </div>
        <div class="chat-messages" id="novadesk-messages">
          <div class="msg msg-bot">Hello! I am your assistant for this page. How can I help you with this website?</div>
        </div>
        <form class="chat-input-area" id="novadesk-form">
          <input class="chat-input" id="novadesk-input" placeholder="Ask anything about this page..." autocomplete="off" />
          <button type="submit" class="chat-send-btn" id="novadesk-send">Send</button>
        </form>
      </div>
    `;

    // 7. Element References & Handlers
    const launcher = shadow.getElementById('novadesk-launcher');
    const chatWindow = shadow.getElementById('novadesk-window');
    const closeBtn = shadow.getElementById('novadesk-close');
    const clearBtn = shadow.getElementById('novadesk-clear');
    const form = shadow.getElementById('novadesk-form');
    const input = shadow.getElementById('novadesk-input');
    const sendBtn = shadow.getElementById('novadesk-send');
    const messagesBox = shadow.getElementById('novadesk-messages');

    launcher.addEventListener('click', () => {
      const isVisible = chatWindow.style.display === 'flex';
      chatWindow.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) input.focus();
    });

    closeBtn.addEventListener('click', () => {
      chatWindow.style.display = 'none';
    });

    clearBtn.addEventListener('click', () => {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now();
      localStorage.setItem('novadesk_session_id', sessionId);
      messagesBox.innerHTML = '<div class="msg msg-bot">Session refreshed. What would you like to know about this page?</div>';
    });

    function parseMarkdown(text) {
      if (!text) return '';
      let safeText = text;
      const codeBlockMatches = (safeText.match(/```/g) || []).length;
      if (codeBlockMatches % 2 !== 0) safeText += '\n```';

      const codeBlocks = [];
      safeText = safeText.replace(/```(?:[a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, codeContent) => {
        const index = codeBlocks.length;
        const sanitized = codeContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        codeBlocks.push(`<pre><code>${sanitized.trim()}</code></pre>`);
        return `__CODE_BLOCK_${index}__`;
      });

      safeText = safeText
        .replace(/`([^`]+)`/g, (match, inlineCode) => {
          const sanitized = inlineCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<code>${sanitized}</code>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');

      safeText = safeText.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => codeBlocks[parseInt(index, 10)] || '');
      return safeText;
    }

    function appendMessage(text, sender) {
      const msg = document.createElement('div');
      msg.className = `msg msg-${sender}`;
      if (sender === 'user') {
        msg.textContent = text;
      } else {
        msg.innerHTML = parseMarkdown(text);
      }
      messagesBox.appendChild(msg);
      messagesBox.scrollTop = messagesBox.scrollHeight;
      return msg;
    }

    // 8. Form Submit & Context Transmission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      appendMessage(text, 'user');
      input.value = '';
      input.disabled = true;
      sendBtn.disabled = true;

      const botMsgElement = document.createElement('div');
      botMsgElement.className = 'msg msg-bot';
      botMsgElement.textContent = '...';
      messagesBox.appendChild(botMsgElement);
      messagesBox.scrollTop = messagesBox.scrollHeight;

      let accumulatedText = '';
      let buffer = '';

      // Live page context grab karna
      const pageContext = extractPageContext();

      try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            message: text, 
            clientId: CLIENT_ID,
            pageContext: pageContext // Scraped webpage details passed here
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let isFirstToken = true;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.replace('data: ', '').trim();
              if (dataStr === '[DONE]') break;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.token) {
                  if (isFirstToken) {
                    botMsgElement.textContent = '';
                    isFirstToken = false;
                  }
                  accumulatedText += parsed.token;
                  botMsgElement.innerHTML = parseMarkdown(accumulatedText);
                  messagesBox.scrollTop = messagesBox.scrollHeight;
                } else if (parsed.error) {
                  botMsgElement.textContent = 'Error: ' + parsed.error;
                }
              } catch (parseErr) {}
            }
          }
        }
      } catch (err) {
        botMsgElement.textContent = `Connection error: ${err.message}`;
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNovaDeskWidget);
  } else {
    initNovaDeskWidget();
  }
})();