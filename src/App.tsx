import React, { useState, useRef, useEffect } from 'react';
import { Send, LogOut, Bot, AlertCircle, Loader2 } from 'lucide-react';

// ── CONFIG ──
const SUPABASE_URL      = 'https://wiavnyuchdsfztzhvaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYXZueXVjaGRzZnp0emh2YXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDI2ODQsImV4cCI6MjA4NjU3ODY4NH0.dXz7vyFglA_lihma__rbtBT8afZZ1YUJEkAmqpFOL6c';
const N8N_WEBHOOK_URL   = 'https://gpixie.app.n8n.cloud/webhook/73c8cf09-d134-445b-950a-94a8eccbe4f8';

// ── TYPES ──
interface UserInfo { id: string; first_name: string; last_name: string; email: string; }
interface ChatMsg  { id: string; role: 'user' | 'agent' | 'system'; text: string; }

// ── FONTS ──
const display = 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif';
const text    = 'SF Pro Text,    SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif';

// ── MARKDOWN ──
function renderMd(raw: string): React.ReactNode {
  return raw.split(/\n\n+/).map((para, pi) => {
    const lines = para.split('\n');
    if (lines.every(l => /^[-*]\s/.test(l.trim()) || !l.trim())) {
      return (
        <ul key={pi} style={{ listStyle: 'none', margin: '6px 0', padding: 0 }}>
          {lines.filter(l => /^[-*]\s/.test(l.trim())).map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#0066cc', flexShrink: 0 }}>•</span>
              <span>{fmt(item.replace(/^[-*]\s*/, ''))}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={pi} style={{ margin: pi > 0 ? '8px 0 0' : 0 }}>
        {lines.map((ln, li) => (
          <React.Fragment key={li}>{li > 0 && <br />}{fmt(ln)}</React.Fragment>
        ))}
      </p>
    );
  });
}
function fmt(s: string): React.ReactNode {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

// ═══════════════════════════════════════════════════
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  // ── LOGIN ──
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pwd.trim()) { setLoginErr('Please enter your email and password.'); return; }
    setLoginLoading(true); setLoginErr('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email.trim())}&select=id,first_name,last_name,email,password`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (!data.length)                  setLoginErr('No account found with this email.');
      else if (data[0].password !== pwd) setLoginErr('Incorrect password. Please try again.');
      else {
        const { password: _, ...u } = data[0];
        setUser(u);
        setMessages([{ id: 'w', role: 'agent', text: `Hello ${u.first_name}! How can I help you today?` }]);
      }
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Connection error. Please try again.');
    } finally { setLoginLoading(false); }
  };

  const logout = () => { setUser(null); setMessages([]); setEmail(''); setPwd(''); };

  // ── SEND ──
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
      const raw = await res.text();
      if (!res.ok) {
        setMessages(p => [...p, { id: (Date.now()+1).toString(), role: 'system', text: `Error ${res.status}: ${raw.slice(0, 200)}` }]);
        return;
      }
      let reply = raw;
      try { const d = JSON.parse(raw); reply = d.output ?? d.text ?? d.response ?? d.message ?? raw; } catch { /* plain text */ }
      setMessages(p => [...p, { id: (Date.now()+1).toString(), role: 'agent', text: reply }]);
    } catch (err) {
      setMessages(p => [...p, { id: (Date.now()+1).toString(), role: 'system', text: `Network error: ${err instanceof Error ? err.message : err}` }]);
    } finally { setSending(false); }
  };

  // ── INPUT STYLE ──
  const field = (name: string): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 16px',
    background: '#ffffff',
    border: `1.5px solid ${focused === name ? '#0071e3' : '#d2d2d7'}`,
    borderRadius: 11,
    color: '#1d1d1f',
    fontSize: 17,
    fontFamily: text,
    letterSpacing: '-0.374px',
    outline: 'none',
    transition: 'border-color 0.15s',
  });

  // ══════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════
  if (!user) return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      fontFamily: text,
    }}>
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#0071e3',
          margin: '0 auto 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'rgba(0,113,227,0.25) 0 8px 24px',
        }}>
          <Bot style={{ width: 38, height: 38, color: '#fff' }} />
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: display,
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.10,
          letterSpacing: '-0.28px',
          color: '#1d1d1f',
          margin: '0 0 10px',
        }}>
          JM20 Support
        </h1>
        <p style={{
          fontSize: 19,
          fontWeight: 300,
          lineHeight: 1.47,
          letterSpacing: '-0.374px',
          color: 'rgba(0,0,0,0.56)',
          margin: '0 0 40px',
        }}>
          Sign in to get help from our team.
        </p>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          padding: '36px 36px 40px',
          boxShadow: 'rgba(0,0,0,0.10) 0 4px 24px, rgba(0,0,0,0.06) 0 1px 4px',
        }}>
          <form onSubmit={login}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder="Email address" autoComplete="email"
                style={field('email')}
              />
              <input
                type="password" value={pwd} onChange={e => setPwd(e.target.value)}
                onFocus={() => setFocused('pwd')} onBlur={() => setFocused(null)}
                placeholder="Password" autoComplete="current-password"
                style={field('pwd')}
              />
            </div>

            {loginErr && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 14px', marginBottom: 20,
                background: 'rgba(255,59,48,0.08)',
                borderRadius: 8,
                color: '#d70015',
                fontSize: 14,
                letterSpacing: '-0.224px',
                lineHeight: 1.43,
                textAlign: 'left',
              }}>
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} />
                {loginErr}
              </div>
            )}

            {/* Primary pill CTA */}
            <button type="submit" disabled={loginLoading} style={{
              width: '100%',
              padding: '13px 22px',
              background: loginLoading ? 'rgba(0,113,227,0.55)' : '#0071e3',
              color: '#ffffff',
              border: '1px solid transparent',
              borderRadius: 980,
              fontSize: 17,
              fontWeight: 400,
              fontFamily: text,
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
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column', fontFamily: text }}>

      {/* ── Nav — translucent glass ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 52,
        background: 'rgba(245,245,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#0071e3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot style={{ width: 15, height: 15, color: '#fff' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', fontFamily: display, letterSpacing: '-0.2px' }}>
            JM20 Support
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.48)', letterSpacing: '-0.12px' }}>
              {user.first_name} {user.last_name}
            </span>
          </div>
          <button onClick={logout} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px',
            background: 'transparent',
            border: '1px solid #0066cc',
            borderRadius: 980,
            color: '#0066cc',
            fontSize: 13,
            fontFamily: text,
            letterSpacing: '-0.12px',
            cursor: 'pointer',
          }}>
            <LogOut style={{ width: 11, height: 11 }} /> Sign Out
          </button>
        </div>
      </nav>

      {/* ── Messages ── */}
      <div style={{
        flex: 1,
        maxWidth: 720, width: '100%',
        margin: '0 auto',
        padding: '32px 20px 120px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {messages.map((m, idx) => {
          const isUser   = m.role === 'user';
          const isSystem = m.role === 'system';
          const newGroup = idx > 0 && messages[idx - 1].role !== m.role;

          if (isSystem) return (
            <div key={m.id} style={{
              alignSelf: 'center', padding: '8px 16px', margin: '8px 0',
              background: 'rgba(255,59,48,0.08)', borderRadius: 8,
              color: '#d70015', fontSize: 13, letterSpacing: '-0.12px', textAlign: 'center',
              maxWidth: '80%',
            }}>{m.text}</div>
          );

          return (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              marginTop: newGroup ? 20 : 3,
            }}>
              <div style={{
                maxWidth: '72%',
                padding: '11px 16px',
                borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                background: isUser ? '#0071e3' : '#ffffff',
                color: isUser ? '#ffffff' : '#1d1d1f',
                fontSize: 17,
                lineHeight: 1.47,
                letterSpacing: '-0.374px',
                boxShadow: 'rgba(0,0,0,0.08) 0 2px 8px',
              }}>
                {m.role === 'agent' ? renderMd(m.text) : m.text}
              </div>
            </div>
          );
        })}

        {/* Typing dots */}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 20 }}>
            <div style={{
              padding: '14px 18px', background: '#ffffff',
              borderRadius: '20px 20px 20px 5px',
              display: 'flex', gap: 5, alignItems: 'center',
              boxShadow: 'rgba(0,0,0,0.08) 0 2px 8px',
            }}>
              {[0, 160, 320].map((d, i) => (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#d2d2d7', display: 'inline-block',
                  animation: `bounce-dot 1.3s ease-in-out ${d}ms infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(245,245,247,0.92)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        padding: '12px 20px 28px',
      }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#ffffff',
          borderRadius: 22,
          padding: '8px 8px 8px 18px',
          boxShadow: 'rgba(0,0,0,0.08) 0 2px 8px',
        }}>
          <input
            type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Message…" disabled={sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#1d1d1f', fontSize: 17, fontFamily: text,
              letterSpacing: '-0.374px', padding: '4px 0',
              opacity: sending ? 0.5 : 1,
            }}
          />
          <button onClick={send} disabled={sending || !input.trim()} style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: (!sending && input.trim()) ? '#0071e3' : '#e5e5ea',
            cursor: (!sending && input.trim()) ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}>
            <Send style={{ width: 15, height: 15, color: (!sending && input.trim()) ? '#fff' : '#8e8e93' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
