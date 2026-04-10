import React, { useState, useRef, useEffect } from 'react';
import { Send, LogOut, Bot, AlertCircle, Loader2 } from 'lucide-react';

// ── CONFIG ──
const SUPABASE_URL      = 'https://wiavnyuchdsfztzhvaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';
const N8N_WEBHOOK_URL   = 'https://gpixie.app.n8n.cloud/webhook/73c8cf09-d134-445b-950a-94a8eccbe4f8';

// ── TYPES ──
interface UserInfo { id: string; first_name: string; last_name: string; email: string; }
interface ChatMsg  { id: string; role: 'user' | 'agent' | 'system'; text: string; }

// ── MARKDOWN ──
function renderMd(text: string): React.ReactNode {
  return text.split(/\n\n+/).map((para, pi) => {
    const lines = para.split('\n');
    const isList = lines.every(l => /^[-*]\s/.test(l.trim()) || l.trim() === '');
    if (isList) {
      return (
        <ul key={pi} style={{ listStyle: 'none', margin: '6px 0', padding: 0 }}>
          {lines.filter(l => /^[-*]\s/.test(l.trim())).map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#2997ff', flexShrink: 0 }}>•</span>
              <span>{inlineFmt(item.replace(/^[-*]\s*/, ''))}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={pi} style={{ margin: pi > 0 ? '8px 0 0' : 0 }}>
        {lines.map((ln, li) => (
          <React.Fragment key={li}>{li > 0 && <br />}{inlineFmt(ln)}</React.Fragment>
        ))}
      </p>
    );
  });
}

function inlineFmt(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

// ── SHARED STYLES ──
const fonts = {
  display: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
  text:    'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
};

// ── APP ──
export default function App() {
  const [user,         setUser]         = useState<UserInfo | null>(null);
  const [email,        setEmail]        = useState('');
  const [pwd,          setPwd]          = useState('');
  const [loginErr,     setLoginErr]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [focused,      setFocused]      = useState<string | null>(null);
  const [messages,     setMessages]     = useState<ChatMsg[]>([]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  // ── LOGIN ──
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pwd.trim()) { setLoginErr('Please enter your email and password.'); return; }
    setLoginLoading(true); setLoginErr('');
    try {
      const res  = await fetch(
        `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email.trim())}&select=id,first_name,last_name,email,password`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (!data.length)                setLoginErr('No account found with this email.');
      else if (data[0].password !== pwd) setLoginErr('Incorrect password. Please try again.');
      else {
        const { password: _, ...u } = data[0];
        setUser(u);
        setMessages([{ id: 'w', role: 'agent', text: `Hello ${u.first_name}! How can I help you today?` }]);
      }
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Connection error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => { setUser(null); setMessages([]); setEmail(''); setPwd(''); };

  // ── SEND MESSAGE ──
  const send = async () => {
    if (!input.trim() || sending) return;
    const txt = input.trim();
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text: txt }]);
    setInput(''); setSending(true);
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', chatInput: txt, customer_id: user?.id ?? '' }),
      });

      // Read body as text first so we never throw on non-JSON
      const raw = await res.text();

      if (!res.ok) {
        setMessages(p => [...p, {
          id: (Date.now()+1).toString(), role: 'system',
          text: `Error ${res.status}: ${raw.slice(0, 200)}`,
        }]);
        return;
      }

      let reply: string;
      try {
        const data = JSON.parse(raw);
        reply = data.output ?? data.text ?? data.response ?? data.message ?? raw;
      } catch {
        reply = raw; // N8N returned plain text — use as-is
      }

      setMessages(p => [...p, { id: (Date.now()+1).toString(), role: 'agent', text: reply }]);
    } catch (err) {
      // Network-level failure (CORS, DNS, no connection)
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(p => [...p, {
        id: (Date.now()+1).toString(), role: 'system',
        text: `Network error: ${msg}`,
      }]);
    } finally {
      setSending(false);
    }
  };

  // ── INPUT FIELD STYLE ──
  const fieldStyle = (name: string): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 16px',
    background: '#1c1c1e',
    border: `1.5px solid ${focused === name ? '#0071e3' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 11,
    color: '#ffffff',
    fontSize: 17,
    fontFamily: fonts.text,
    letterSpacing: '-0.374px',
    outline: 'none',
    transition: 'border-color 0.15s',
  });

  // ══════════════════════════════════════
  // LOGIN PAGE
  // ══════════════════════════════════════
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        fontFamily: fonts.text,
      }}>
        {/* Card — Apple dark surface, no border, soft shadow */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: '#272729',
          borderRadius: 12,
          boxShadow: 'rgba(0,0,0,0.22) 3px 5px 30px 0px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '48px 40px 32px', textAlign: 'center' }}>
            {/* Icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#0071e3',
              margin: '0 auto 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot style={{ width: 36, height: 36, color: '#ffffff' }} />
            </div>

            <h1 style={{
              fontFamily: fonts.display,
              fontSize: 28,
              fontWeight: 600,
              lineHeight: 1.10,
              letterSpacing: '-0.28px',
              color: '#ffffff',
              margin: '0 0 8px',
            }}>
              JM20 Support
            </h1>
            <p style={{
              fontSize: 17,
              fontWeight: 400,
              lineHeight: 1.47,
              letterSpacing: '-0.374px',
              color: 'rgba(255,255,255,0.56)',
              margin: 0,
            }}>
              Sign in to your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={login} style={{ padding: '0 40px 48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder="Email"
                autoComplete="email"
                style={fieldStyle('email')}
              />
              <input
                type="password" value={pwd}
                onChange={e => setPwd(e.target.value)}
                onFocus={() => setFocused('pwd')} onBlur={() => setFocused(null)}
                placeholder="Password"
                autoComplete="current-password"
                style={fieldStyle('pwd')}
              />
            </div>

            {loginErr && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 14px', marginBottom: 16,
                background: 'rgba(255,69,58,0.12)',
                borderRadius: 8,
                color: '#ff453a',
                fontSize: 14,
                letterSpacing: '-0.224px',
                lineHeight: 1.43,
              }}>
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} />
                {loginErr}
              </div>
            )}

            {/* Primary Apple Blue CTA */}
            <button type="submit" disabled={loginLoading} style={{
              width: '100%',
              padding: '8px 15px',
              minHeight: 44,
              background: loginLoading ? 'rgba(0,113,227,0.6)' : '#0071e3',
              color: '#ffffff',
              border: '1px solid transparent',
              borderRadius: 8,
              fontSize: 17,
              fontWeight: 400,
              fontFamily: fonts.text,
              letterSpacing: '-0.374px',
              cursor: loginLoading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}>
              {loginLoading && <Loader2 style={{ width: 16, height: 16 }} className="spin" />}
              {loginLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // CHAT PAGE
  // ══════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      display: 'flex', flexDirection: 'column',
      fontFamily: fonts.text,
    }}>
      {/* ── Apple-style glass navigation bar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 48,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between',
      }}>
        {/* Left — brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#0071e3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot style={{ width: 16, height: 16, color: '#fff' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 400, color: '#ffffff', letterSpacing: '-0.224px' }}>
            JM20 Support
          </span>
        </div>

        {/* Right — user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#30d158', display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.56)', letterSpacing: '-0.12px' }}>
              {user.first_name} {user.last_name}
            </span>
          </div>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 980,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            fontFamily: fonts.text,
            letterSpacing: '-0.12px',
            cursor: 'pointer',
          }}>
            <LogOut style={{ width: 11, height: 11 }} /> Sign Out
          </button>
        </div>
      </nav>

      {/* ── Chat area ── */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        maxWidth: 700, width: '100%',
        margin: '0 auto',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto',
            padding: '24px 0 16px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          {messages.map((m, idx) => {
            const isUser   = m.role === 'user';
            const isSystem = m.role === 'system';
            const newGroup = idx > 0 && messages[idx - 1].role !== m.role;

            if (isSystem) return (
              <div key={m.id} style={{
                alignSelf: 'center',
                padding: '8px 16px',
                margin: '8px 0',
                background: 'rgba(255,69,58,0.12)',
                borderRadius: 8,
                color: '#ff453a',
                fontSize: 13,
                letterSpacing: '-0.12px',
                maxWidth: '80%',
                textAlign: 'center',
              }}>
                {m.text}
              </div>
            );

            return (
              <div key={m.id} style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginTop: newGroup ? 16 : 2,
              }}>
                <div style={{
                  maxWidth: '72%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isUser ? '#0071e3' : '#272729',
                  color: '#ffffff',
                  fontSize: 17,
                  lineHeight: 1.47,
                  letterSpacing: '-0.374px',
                  boxShadow: 'rgba(0,0,0,0.22) 3px 5px 30px 0px',
                }}>
                  {m.role === 'agent' ? renderMd(m.text) : m.text}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16 }}>
              <div style={{
                padding: '14px 18px',
                background: '#272729',
                borderRadius: '18px 18px 18px 4px',
                display: 'flex', gap: 5, alignItems: 'center',
                boxShadow: 'rgba(0,0,0,0.22) 3px 5px 30px 0px',
              }}>
                {[0, 160, 320].map((d, i) => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.4)',
                    display: 'inline-block',
                    animation: `bounce-dot 1.3s ease-in-out ${d}ms infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 0 24px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#1c1c1e',
            borderRadius: 22,
            padding: '8px 8px 8px 18px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Message…"
              disabled={sending}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none', outline: 'none',
                color: '#ffffff',
                fontSize: 17,
                fontFamily: fonts.text,
                letterSpacing: '-0.374px',
                padding: '4px 0',
                opacity: sending ? 0.5 : 1,
              }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              style={{
                width: 34, height: 34,
                borderRadius: '50%',
                border: 'none',
                flexShrink: 0,
                background: (!sending && input.trim()) ? '#0071e3' : '#3a3a3c',
                cursor: (!sending && input.trim()) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <Send style={{ width: 15, height: 15, color: '#ffffff' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
