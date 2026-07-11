import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye, EyeOff, ArrowRight, UserPlus, CheckCircle,
  User, Mail, Phone, Lock, Building2, ChevronDown,
} from 'lucide-react'
import axios from 'axios'
import { authService } from '@/services/services'
import toast from 'react-hot-toast'

// ── Validation schema matching the backend RegisterSerializer ──────────────────
const schema = z.object({
  name: z.string().min(2, 'Full name is required (min 2 chars)'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Enter a valid phone number (e.g. +919876543210)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
  depot_id: z.string().min(1, 'Please select a depot'),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

// ── Password strength meter ────────────────────────────────────────────────────
function PasswordStrength({ password = '' }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',       ok: /[a-z]/.test(password) },
    { label: 'Number',                 ok: /[0-9]/.test(password) },
    { label: 'Special character',      ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const color = score <= 2 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#22c55e'
  const label = score <= 2 ? 'Weak' : score <= 3 ? 'Fair' : score === 5 ? 'Strong' : 'Good'

  if (!password) return null

  return (
    <div style={{ marginTop: 8 }}>
      {/* Strength bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= score ? color : 'var(--border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
        <span style={{ fontSize: 10, color, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 4 }}>
          {label}
        </span>
      </div>
      {/* Checklist */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {checks.map(({ label: l, ok }) => (
          <span key={l} style={{ fontSize: 10, color: ok ? '#22c55e' : 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {ok ? '✓' : '○'} {l}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Field wrapper with icon ────────────────────────────────────────────────────
function Field({ label, icon: Icon, error, children, hint }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" style={{ marginBottom: 5 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {Icon && (
          <Icon
            size={14}
            style={{
              position: 'absolute', left: 11, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)', pointerEvents: 'none', zIndex: 1,
            }}
          />
        )}
        {children}
      </div>
      {hint && !error && <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

const iconStyle = { paddingLeft: 34 }

// ── Main Register Page ─────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [showPw, setShowPw]         = useState(false)
  const [showCPw, setShowCPw]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const [depots, setDepots]         = useState([])
  const navigate                    = useNavigate()

  const {
    register, handleSubmit, watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  })

  const password = watch('password', '')


  // Load depots on mount — use plain axios (no auth interceptor) so we never
  // trigger the 401 → redirect-to-login flow on the public register page.
  useEffect(() => {
    axios.get('/api/depots/', { params: { page_size: 100 } })
      .then((r) => setDepots(r.data?.results || []))
      .catch(() => {})
  }, [])

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await authService.register({
        name:             data.name,
        email:            data.email,
        phone:            data.phone,
        password:         data.password,
        confirm_password: data.confirm_password,
        role:             'PASSENGER',
        depot_id:         data.depot_id,
        accept_terms:     data.terms,
      })
      setSuccess(true)
      toast.success('Account created! Please check your email to verify your account.')
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) {
        const msg = Object.entries(data.errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n')
        toast.error(msg || 'Registration failed.')
      } else {
        toast.error(data?.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e22, #22c55e44)',
          border: '2px solid #22c55e44',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <CheckCircle size={28} style={{ color: '#22c55e' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Account Created!
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          We've sent a verification link to your email address.
          Please verify your email before signing in.
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => navigate('/')}
        >
          Go to Sign In <ArrowRight size={14} />
        </button>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <UserPlus size={15} style={{ color: 'white' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Create your account
        </h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Join the Smart Transport network — it's free.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
          <Field label="Full Name *" icon={User} error={errors.name?.message}>
            <input
              id="reg-name"
              type="text"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Aarav Sharma"
              style={iconStyle}
              autoComplete="name"
              {...register('name')}
            />
          </Field>

          {/* Email */}
          <Field label="Email Address *" icon={Mail} error={errors.email?.message}>
            <input
              id="reg-email"
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="you@example.com"
              style={iconStyle}
              autoComplete="email"
              {...register('email')}
            />
          </Field>

          {/* Phone */}
          <Field
            label="Phone Number *"
            icon={Phone}
            error={errors.phone?.message}
            hint="Include country code, e.g. +919876543210"
          >
            <input
              id="reg-phone"
              type="tel"
              className={`form-input ${errors.phone ? 'error' : ''}`}
              placeholder="+919876543210"
              style={iconStyle}
              autoComplete="tel"
              {...register('phone')}
            />
          </Field>

          {/* Depot */}
          <Field label="Select Depot *" icon={Building2} error={errors.depot_id?.message}>
            <select
              id="reg-depot"
              className={`form-input ${errors.depot_id ? 'error' : ''}`}
              style={{ ...iconStyle, appearance: 'none', paddingRight: 36 }}
              {...register('depot_id')}
            >
              <option value="">Choose your nearest depot…</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
          </Field>

          {/* Password */}
          <Field label="Password *" icon={Lock} error={errors.password?.message}>
            <input
              id="reg-password"
              type={showPw ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Min 8 chars with uppercase, number & symbol"
              style={{ ...iconStyle, paddingRight: 40 }}
              autoComplete="new-password"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
              }}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </Field>
          <PasswordStrength password={password} />

          {/* Confirm Password */}
          <Field label="Confirm Password *" icon={Lock} error={errors.confirm_password?.message}>
            <input
              id="reg-confirm-password"
              type={showCPw ? 'text' : 'password'}
              className={`form-input ${errors.confirm_password ? 'error' : ''}`}
              placeholder="Re-enter your password"
              style={{ ...iconStyle, paddingRight: 40 }}
              autoComplete="new-password"
              {...register('confirm_password')}
            />
            <button
              type="button"
              onClick={() => setShowCPw((s) => !s)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
              }}
            >
              {showCPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </Field>

          {/* Terms */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="reg-terms"
              {...register('terms')}
              style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              I agree to the{' '}
              <a href="#" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Privacy Policy</a>
            </span>
          </label>
          {errors.terms && <p className="form-error" style={{ marginTop: -8 }}>{errors.terms.message}</p>}

          {/* Submit */}
          <button
            type="submit"
            id="register-submit-btn"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Creating account…
              </>
            ) : (
              <>Create Account <UserPlus size={14} /></>
            )}
          </button>
        </div>
      </form>

      {/* Sign in link */}
      <div style={{
        marginTop: 20, padding: '14px 16px',
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', textAlign: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
        </span>
        <Link
          to="/"
          style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          Sign in →
        </Link>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
