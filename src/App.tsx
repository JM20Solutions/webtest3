import React, { useState, useRef, useEffect } from 'react';
import {
  Send, LogIn, LogOut, Lock, Mail,
  Sparkles, AlertCircle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── CONFIGURATION ──
// 1. Put your Supabase URL and Anon Key here
const SUPABASE_URL = 'https://wiavnyuchdsfztzhvaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';

// 2. Put your n8n Webhook URL here
const N8N_WEBHOOK_URL = 'https://gpixie.app.n8n.cloud/webhook/dcf09b4f-67fb-4bc6-a50c-9fb9fffacd01';

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

// ── SIMPLE MARKDOWN RENDERER ──
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
              <span className="text-indigo-500 mt-1 shrink-0">•</span>
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
      return <strong key={i} className="font-semibold text-blue-200">{part.slice(2, -2)}</strong>;
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
        { 
          headers: { 
            'apikey': SUPABASE_ANON_KEY, 
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}` 
          } 
        }
      );
      
      const data = await res.json();

      if (data.length === 0) {
        setLoginError('Account not found.');
      } else if (data[0].password !== loginPassword) {
        setLoginError('Incorrect password.');
      } else {
        const { password: _, ...userData } = data[0];
        setUser(userData);
        setMessages([{ 
          id: 'welcome', 
          role: 'agent', 
          text: `Hello ${userData.first_name}! How can I help you today?` 
        }]);
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
        body: JSON.stringify({
          action: 'sendMessage',
          chatInput: userText,
          customer_id: user?.id || ''
        })
      });

      const data = await response.json();
      const reply = data.output || data.text || data.response || data.message || JSON.stringify(data);

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: 'Error connecting to n8n. Please check your webhook URL.'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f45 50%, #0a1a3a 100%)' }}>
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md rounded-[2rem] overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="p-8 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full -translate-x-8 -translate-y-16" style={{ background: 'radial-gradient(circle, rgba(99,179,237,0.15) 0%, transparent 70%)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-1">
                  <Sparkles className="w-6 h-6 text-blue-300" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-300">Customer Support</span>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight">JM20 Agentic<br />Customer Support Services</h1>
                <p className="text-blue-200/60 text-sm mt-2">Sign in to start your support session</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70 mb-2 block">Email Address</label>
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Mail className="w-4 h-4 text-blue-300/60" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-grow bg-transparent border-none text-sm outline-none text-white placeholder:text-white/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-blue-300/70 mb-2 block">Password</label>
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Lock className="w-4 h-4 text-blue-300/60" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="flex-grow bg-transparent border-none text-sm outline-none text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loginError}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full text-white py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 8px 24px rgba(37,99,235,0.4)' }}
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
            className="w-full max-w-2xl h-[80vh] rounded-[2.5rem] flex flex-col overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="p-6 flex justify-between items-center shrink-0" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg leading-none text-white">JM20 Agentic Support</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300/60">Connected as {user.first_name}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-3 rounded-full transition-colors text-blue-300/60 hover:text-white hover:bg-white/10"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
              style={{ background: 'rgba(0,0,0,0.15)' }}
            >
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-5 py-3 text-sm leading-relaxed rounded-2xl ${
                    m.role === 'user'
                      ? 'rounded-tr-none text-white'
                      : m.role === 'system'
                      ? 'w-full text-center italic text-xs'
                      : 'rounded-tl-none text-blue-50'
                  }`} style={
                    m.role === 'user'
                      ? { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }
                      : m.role === 'system'
                      ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }
                      : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }
                  }>
                    {m.role === 'agent' ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-none px-6 py-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-3 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  disabled={isChatLoading}
                  className="flex-grow bg-transparent border-none py-3 px-4 text-sm outline-none text-white placeholder:text-white/30 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatLoading || !inputMessage.trim()}
                  className="w-12 h-12 text-white rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
