import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bus, Shield, QrCode, TrendingUp } from 'lucide-react'

const FEATURES = [
  { icon: Bus, title: 'Real-time Bus Tracking', desc: 'Track your bus live on the map with accurate ETAs' },
  { icon: QrCode, title: 'Digital Tickets & Passes', desc: 'Book tickets instantly, scan QR codes to board' },
  { icon: TrendingUp, title: 'Smart Route Planning', desc: 'Find optimal routes with live seat availability' },
  { icon: Shield, title: 'Secure & Reliable', desc: 'Enterprise-grade security for your daily commute' },
]

const STATS = [
  { value: '12,400+', label: 'Journeys Today' },
  { value: '480+', label: 'Active Buses' },
  { value: '98.2%', label: 'On-time Rate' },
  { value: '3.2L+', label: 'Passengers' },
]

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      {/* ── Brand Panel ── */}
      <div className="auth-brand-panel">
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{
              width: 36, height: 36, background: 'rgba(59,130,246,0.9)',
              borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M2 12V5a1 1 0 011-1h10a1 1 0 011 1v7M2 12h12M5 11V8M8 11V7M11 11V9"
                  stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="4" cy="13" r="1" fill="white"/>
                <circle cx="12" cy="13" r="1" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'white', letterSpacing: '-0.02em' }}>Smart Transport</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Solution · Passenger Portal</div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 30, fontWeight: 800, color: 'white',
            letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 12,
          }}>
            Smarter travel,<br />every day.
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 36 }}>
            Book tickets, track buses live, and manage your transport passes — all in one place.
          </p>

          {/* Features */}
          <div>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="auth-feature-item">
                <div style={{
                  width: 30, height: 30, borderRadius: 6,
                  background: 'rgba(59,130,246,0.2)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color: '#93c5fd' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="auth-stat-grid">
            {STATS.map(({ value, label }) => (
              <div key={label} className="auth-stat-item">
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.03em' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form Panel ── */}
      <div className="auth-form-panel">
        <motion.div
          className="auth-form-inner"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Mobile-only logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--primary)',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 12V5a1 1 0 011-1h10a1 1 0 011 1v7M2 12h12M5 11V8M8 11V7M11 11V9"
                  stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="4" cy="13" r="1" fill="white"/>
                <circle cx="12" cy="13" r="1" fill="white"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Smart Transport Solution
            </div>
          </div>

          <Outlet />

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
              © 2026 Smart Transport Solution. All rights reserved.
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
