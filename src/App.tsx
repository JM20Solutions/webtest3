import React, { useState, useRef, useEffect } from 'react';
import {
  Send, LogIn, LogOut, Lock, Mail,
  Bot, AlertCircle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── CONFIGURATION ──
const SUPABASE_URL = 'https://wiavnyuchdsfztzhvaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';
const N8N_WEBHOOK_URL = 'https://gpixie.app.n8n.cloud/webhook/73c8cf09-d134-445b-950a-94a8eccbe4f8';

interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
}

function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split(/\n/);
    const isList = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || l.trim() === '');

    if (isList) {
      const items = lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
      return (
        <ul key={pIdx} className="list-none space-y-1.5 my-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span style={{ color: 'var(--accent)' }} className="mt-1 shrink-0">•</span>
              <span>{applyInlineFormatting(item.replace(/^[-*]\s*/, ''))}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {applyInlineFormatting(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function applyInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatLoading]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(loginEmail.trim())}&select=id,first_name,last_name,email,password`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (data.length === 0) {
        setLoginError('Account not found.');
      } else if (data[0].password !== loginPassword) {
        setLoginError('Incorrect password.');
      } else {
        const { password: _, ...userData } = data[0];
        setUser(userData);
        setMessages([{ id: 'welcome', role: 'agent', text: `Hello ${userData.first_name}! How can I help you today?` }]);
      }
    } catch (err) {
      setLoginError('Connection error. Please check your Supabase URL and Key.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMessages([]);
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isChatLoading) return;
    const userText = inputMessage.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    setInputMessage('');
    setIsChatLoading(true);
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', chatInput: userText, customer_id: user?.id || '' })
      });
      const data = await response.json();
      const reply = data.output || data.text || data.response || data.message || JSON.stringify(data);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'system', text: 'Error connecting to n8n. Please check your webhook URL.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="p-8 relative overflow-hidden" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -translate-x-8 -translate-y-16" style={{ background: 'var(--accent-glow)' }} />
              <div className="relative z-10 flex items-center gap-5">
                <div className="w-14 h-14 flex items-center justify-center shrink-0" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', boxShadow: '0 0 20px var(--accent-glow)' }}>
                  <Bot className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, fontVariantNumeric: 'lining-nums' }}>JM20</h1>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '2px' }}>Agentic Customer Support Services</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block mb-2" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Email Address</label>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-grow bg-transparent border-none text-sm outline-none"
                      style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Password</label>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <Lock className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="flex-grow bg-transparent border-none text-sm outline-none"
                      style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
                    />
                  </div>
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-3 text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', color: 'var(--red)' }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loginError}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#080c14', borderRadius: 'var(--radius)', boxShadow: '0 4px 20px var(--accent-glow)' }}
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Sign In
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
          >
            <div className="p-5 flex justify-between items-center shrink-0" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)' }}>
                  <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1rem', color: 'var(--text)', lineHeight: 1 }}>JM20 Agentic Support</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Connected as {user.first_name}</span>
                  </div>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }} title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4" style={{ background: 'var(--bg)' }}>
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user' ? 'rounded-2xl rounded-tr-none'
                      : m.role === 'system' ? 'w-full text-center italic text-xs rounded-xl'
                      : 'rounded-2xl rounded-tl-none'
                    }`}
                    style={
                      m.role === 'user'
                        ? { background: 'var(--accent)', color: '#080c14', fontWeight: 500 }
                        : m.role === 'system'
                        ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--red)' }
                        : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }
                    }
                  >
                    {m.role === 'agent' ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="px-5 py-4 rounded-2xl rounded-tl-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <div className="flex items-center gap-3 px-4 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)' }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  disabled={isChatLoading}
                  className="flex-grow bg-transparent border-none py-2 text-sm outline-none disabled:opacity-50"
                  style={{ color: 'var(--text)', caretColor: 'var(--accent)' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatLoading || !inputMessage.trim()}
                  className="w-9 h-9 flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#080c14', borderRadius: 'var(--radius)' }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
