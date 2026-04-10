import React, { useState, useRef, useEffect } from 'react';
import { Send, LogOut, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── CONFIGURATION ──
const SUPABASE_URL = 'https://wiavnyuchdsfztzhvaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';
const N8N_WEBHOOK_URL = 'https://gpixie.app.n8n.cloud/webhook/73c8cf09-d134-445b-950a-94a8eccbe4f8';

// ── APPLE DESIGN TOKENS ──
const a = {
  bgPrimary:    '#000000',
  bgSecondary:  '#1C1C1E',
  bgTertiary:   '#2C2C2E',
  bgQuaternary: '#3A3A3C',
  glassBg:      'rgba(28, 28, 30, 0.82)',
  glassBorder:  'rgba(255, 255, 255, 0.08)',
  textPrimary:  '#F5F5F7',
  textSecondary:'#A1A1A6',
  textTertiary: '#636366',
  accent:       '#0071E3',
  accentBlue:   '#0A84FF',
  accentGlow:   'rgba(0, 113, 227, 0.28)',
  green:        '#30D158',
  red:          '#FF453A',
  separator:    'rgba(255, 255, 255, 0.10)',
  separatorOpaque: '#38383A',
} as const;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const SFDisplay = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

// ── TYPES ──
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

// ── MARKDOWN RENDERER ──
function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split(/\n/);
    const isList = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || l.trim() === '');

    if (isList) {
      const items = lines.filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
      return (
        <ul key={pIdx} style={{ listStyle: 'none', margin: '6px 0', padding: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ color: a.accentBlue, flexShrink: 0, lineHeight: 1.45 }}>•</span>
              <span>{applyInline(item.replace(/^[-*]\s*/, ''))}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={pIdx} style={{ margin: pIdx > 0 ? '8px 0 0' : '0' }}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {applyInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function applyInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

// ── APP ──
export default function App() {
  const [user, setUser]               = useState<UserInfo | null>(null);
  const [loginEmail, setLoginEmail]   = useState('');
  const [loginPwd, setLoginPwd]       = useState('');
  const [loginError, setLoginError]   = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [focused, setFocused]         = useState<string | null>(null);

  const [messages, setMessages]       = useState<ChatMsg[]>([]);
  const [inputMsg, setInputMsg]       = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chatLoading]);

  // ── HANDLERS ──
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || !loginPwd.trim()) {
      setLoginError('Please enter your email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(loginEmail.trim())}&select=id,first_name,last_name,email,password`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (data.length === 0) {
        setLoginError('No account found with that email.');
      } else if (data[0].password !== loginPwd) {
        setLoginError('Incorrect password. Please try again.');
      } else {
        const { password: _pw, ...userData } = data[0];
        setUser(userData);
        setMessages([{ id: 'welcome', role: 'agent', text: `Hello ${userData.first_name}! How can I help you today?` }]);
      }
    } catch {
      setLoginError('Connection error. Please check your network.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMessages([]);
    setLoginEmail('');
    setLoginPwd('');
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || chatLoading) return;
    const text = inputMsg.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    setInputMsg('');
    setChatLoading(true);
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', chatInput: text, customer_id: user?.id ?? '' }),
      });
      const data = await res.json();
      const reply = data.output ?? data.text ?? data.response ?? data.message ?? JSON.stringify(data);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'system', text: 'Failed to send. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // ── SHARED STYLES ──
  const field = (name: string): React.CSSProperties => ({
    width: '100%',
    padding: '14px 16px',
    background: a.bgTertiary,
    border: `1px solid ${focused === name ? a.accentBlue : 'rgba(255,255,255,0.06)'}`,
    borderRadius: 12,
    color: a.textPrimary,
    fontSize: 15,
    fontFamily: SF,
    outline: 'none',
    transition: 'border-color 0.18s ease',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
  });

  // ── RENDER ──
  return (
    <div style={{
      minHeight: '100vh',
      background: a.bgPrimary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: SF,
    }}>
      <AnimatePresence mode="wait">

        {/* ════════════════════════════════════════
            LOGIN SCREEN
        ════════════════════════════════════════ */}
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 400,
              background: a.glassBg,
              border: `1px solid ${a.glassBorder}`,
              borderRadius: 20,
              boxShadow: '0 32px 96px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '48px 40px 32px', textAlign: 'center' }}>
              {/* Icon */}
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(150deg, #1a8cff 0%, #0050c8 100%)',
                margin: '0 auto 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 12px 40px ${a.accentGlow}, 0 0 0 1px rgba(255,255,255,0.1) inset`,
              }}>
                <Bot style={{ width: 42, height: 42, color: '#fff' }} />
              </div>
              <h1 style={{
                fontFamily: SFDisplay,
                fontSize: 28, fontWeight: 700,
                color: a.textPrimary,
                letterSpacing: '-0.5px',
                margin: '0 0 8px',
              }}>
                JM20 Support
              </h1>
              <p style={{ color: a.textSecondary, fontSize: 15, margin: 0 }}>
                Sign in to your account
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} style={{ padding: '0 40px 44px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="Email"
                  autoComplete="email"
                  style={field('email')}
                />
                <input
                  type="password"
                  value={loginPwd}
                  onChange={e => setLoginPwd(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="Password"
                  autoComplete="current-password"
                  style={field('password')}
                />
              </div>

              <AnimatePresence>
                {loginError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 14 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      background: 'rgba(255, 69, 58, 0.12)',
                      border: '1px solid rgba(255, 69, 58, 0.24)',
                      borderRadius: 10,
                      color: a.red,
                      fontSize: 13,
                    }}>
                      <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
                      {loginError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loginLoading ? 'rgba(0,113,227,0.65)' : a.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: SF,
                  letterSpacing: '-0.1px',
                  cursor: loginLoading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s ease',
                }}
              >
                {loginLoading && <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" />}
                {loginLoading ? 'Signing In…' : 'Sign In'}
              </button>
            </form>
          </motion.div>

        ) : (

          /* ════════════════════════════════════════
              CHAT SCREEN
          ════════════════════════════════════════ */
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 680,
              height: '84vh',
              maxHeight: 740,
              display: 'flex',
              flexDirection: 'column',
              background: a.glassBg,
              border: `1px solid ${a.glassBorder}`,
              borderRadius: 20,
              boxShadow: '0 32px 96px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* ── Nav Bar ── */}
            <div className="glass-bar" style={{
              padding: '14px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${a.separator}`,
              background: 'rgba(28,28,30,0.65)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(150deg, #1a8cff 0%, #0050c8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 14px ${a.accentGlow}`,
                  flexShrink: 0,
                }}>
                  <Bot style={{ width: 21, height: 21, color: '#fff' }} />
                </div>
                <div>
                  <div style={{
                    fontFamily: SFDisplay,
                    fontSize: 15, fontWeight: 600,
                    color: a.textPrimary,
                    letterSpacing: '-0.2px',
                    lineHeight: 1.2,
                  }}>
                    JM20 Support
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: a.green,
                      boxShadow: `0 0 6px ${a.green}88`,
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: a.textSecondary }}>
                      {user.first_name} {user.last_name}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${a.separator}`,
                  borderRadius: 8,
                  color: a.textSecondary,
                  fontSize: 13,
                  fontFamily: SF,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <LogOut style={{ width: 13, height: 13 }} />
                Sign Out
              </button>
            </div>

            {/* ── Messages ── */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                background: a.bgPrimary,
              }}
            >
              {messages.map((m, idx) => {
                const isUser   = m.role === 'user';
                const isSystem = m.role === 'system';
                const groupGap = idx > 0 && messages[idx - 1].role !== m.role;

                if (isSystem) {
                  return (
                    <div key={m.id} style={{
                      alignSelf: 'center',
                      padding: '7px 14px',
                      background: 'rgba(255,69,58,0.12)',
                      border: '1px solid rgba(255,69,58,0.22)',
                      borderRadius: 10,
                      color: a.red,
                      fontSize: 12,
                      margin: '8px 0',
                    }}>
                      {m.text}
                    </div>
                  );
                }

                return (
                  <div key={m.id} style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    marginTop: groupGap ? 14 : 2,
                  }}>
                    <div style={{
                      maxWidth: '72%',
                      padding: '10px 14px',
                      /* iMessage-style bubble radius */
                      borderRadius: isUser
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                      background: isUser ? a.accentBlue : a.bgTertiary,
                      color: a.textPrimary,
                      fontSize: 15,
                      lineHeight: 1.45,
                    }}>
                      {m.role === 'agent' ? renderMarkdown(m.text) : m.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {chatLoading && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-start',
                  marginTop: messages.length > 0 && messages[messages.length - 1].role !== 'agent' ? 14 : 2,
                }}>
                  <div style={{
                    padding: '13px 18px',
                    background: a.bgTertiary,
                    borderRadius: '18px 18px 18px 4px',
                    display: 'flex', gap: 6, alignItems: 'center',
                  }}>
                    {[0, 160, 320].map((delay, i) => (
                      <span key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: a.textTertiary,
                        display: 'inline-block',
                        animation: `bounce-dot 1.3s ease-in-out infinite`,
                        animationDelay: `${delay}ms`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Input Bar ── */}
            <div className="glass-bar" style={{
              padding: '12px 16px',
              borderTop: `1px solid ${a.separator}`,
              background: 'rgba(28,28,30,0.85)',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: a.bgTertiary,
                borderRadius: 22,
                padding: '8px 8px 8px 18px',
                border: `1px solid ${a.separator}`,
              }}>
                <input
                  type="text"
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Message…"
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none', outline: 'none',
                    color: a.textPrimary,
                    fontSize: 15,
                    fontFamily: SF,
                    padding: '4px 0',
                    opacity: chatLoading ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={chatLoading || !inputMsg.trim()}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: (!chatLoading && inputMsg.trim()) ? a.accentBlue : a.bgQuaternary,
                    border: 'none',
                    cursor: (!chatLoading && inputMsg.trim()) ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  <Send style={{
                    width: 15, height: 15,
                    color: (!chatLoading && inputMsg.trim()) ? '#fff' : a.textTertiary,
                    transition: 'color 0.2s ease',
                  }} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
