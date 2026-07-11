import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ArrowRight, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const user = await login(data.email, data.password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid credentials. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.02em' }}>
        Sign in to your account
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Enter your credentials to access the portal
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className={`form-input ${errors.email ? 'error' : ''}`}
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
            <Link
              to="/forgot-password"
              style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}
            >
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="••••••••"
              style={{ paddingRight: 40 }}
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0, display: 'flex',
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && <p className="form-error">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={loading}
          style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }} />
              Signing in…
            </>
          ) : (
            <>Sign in <ArrowRight size={15} /></>
          )}
        </button>
      </form>

      {/* Demo credentials collapsible */}
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setShowDemo(d => !d)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12,
            color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'inherit',
            borderBottomLeftRadius: showDemo ? 0 : 'var(--radius)',
            borderBottomRightRadius: showDemo ? 0 : 'var(--radius)',
          }}
        >
          <span>Demo credentials</span>
          <ChevronDown size={13} style={{ transform: showDemo ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
        </button>
        {showDemo && (
          <div style={{
            padding: '10px 12px', background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
            borderRadius: '0 0 var(--radius) var(--radius)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {[
              { role: 'Admin', email: 'admin1@smts.app', password: 'Admin@123' },
              { role: 'Passenger', email: 'aarav.sharma@example.com', password: 'Pass@1234' },
            ].map(({ role, email, password }) => (
              <div key={role} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 8px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--primary)',
                    background: 'var(--primary-light)', padding: '1px 6px', borderRadius: 3,
                    marginRight: 8, textTransform: 'uppercase',
                  }}>{role}</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{email}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{password}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register link */}
      <div style={{
        marginTop: 20, padding: '14px 16px',
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', textAlign: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
        </span>
        <Link
          to="/register"
          style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
        >
          Create account →
        </Link>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
