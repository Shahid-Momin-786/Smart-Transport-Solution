import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService, authService, depotService } from '@/services/services'
import { useAuth } from '@/contexts/AuthContext'
import { User, Lock, Building2, Shield, Eye, EyeOff, Save, Check } from 'lucide-react'
import toast from 'react-hot-toast'

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card mb-5">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="card-title text-sm">{title}</span>
        </div>
      </div>
      <div className="card-body space-y-4">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <label className="form-label sm:pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

const SETTINGS_NAV = [
  { id: 'profile',  icon: User,      label: 'Profile' },
  { id: 'security', icon: Lock,      label: 'Security' },
  { id: 'depot',    icon: Building2, label: 'Depot' },
  { id: 'account',  icon: Shield,    label: 'Account' },
]

export default function AdminSettings() {
  const { user: authUser } = useAuth()
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = useState('profile')

  // ─── Profile form ───────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => userService.me().then(r => r.data),
  })

  const [profileForm, setProfileForm] = useState(null)
  // Initialise form once profile loads
  if (profile && profileForm === null) {
    setProfileForm({ name: profile.name || '', phone: profile.phone || '', email: profile.email || '' })
  }

  const profileMutation = useMutation({
    mutationFn: (data) => userService.me(data),
    onSuccess: () => {
      toast.success('Profile updated successfully.')
      queryClient.invalidateQueries(['admin-me'])
      queryClient.invalidateQueries(['auth-me'])
    },
    onError: (err) => {
      const msg = Object.values(err.response?.data || {}).flat().join('. ')
      toast.error(msg || 'Failed to update profile.')
    },
  })

  const handleProfileSave = (e) => {
    e.preventDefault()
    profileMutation.mutate(profileForm)
  }

  // ─── Password form ──────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const passwordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully.')
      setPasswordForm({ old_password: '', new_password: '', confirm: '' })
    },
    onError: (err) => {
      const msg = err.response?.data?.old_password || err.response?.data?.detail || 'Failed to change password.'
      toast.error(Array.isArray(msg) ? msg[0] : msg)
    },
  })

  const handlePasswordSave = (e) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm) {
      return toast.error('New passwords do not match.')
    }
    if (passwordForm.new_password.length < 8) {
      return toast.error('Password must be at least 8 characters.')
    }
    passwordMutation.mutate({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    })
  }

  // ─── Depot info ─────────────────────────────────────────────
  const { data: depot } = useQuery({
    queryKey: ['depot-detail', profile?.depot],
    queryFn: () => depotService.get(profile.depot).then(r => r.data),
    enabled: !!profile?.depot,
  })

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account, security, and depot information</p>
        </div>
      </div>

      <div className="settings-shell">
        {/* Left nav */}
        <div className="settings-nav">
          {SETTINGS_NAV.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`settings-nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div>

          {activeSection === 'profile' && <Section title="Profile Information" icon={User}>
        {profileLoading || !profileForm ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-9 rounded" />)}</div>
        ) : (
          <form onSubmit={handleProfileSave} className="space-y-4">
            <FieldRow label="Full Name">
              <input
                className="form-input"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </FieldRow>
            <FieldRow label="Email">
              <input
                type="email"
                className="form-input"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </FieldRow>
            <FieldRow label="Phone">
              <input
                type="tel"
                className="form-input"
                value={profileForm.phone}
                onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. +91 98765 43210"
              />
            </FieldRow>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={profileMutation.isPending}
              >
                {profileMutation.isSuccess ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
              </button>
            </div>
          </form>
        )}
          </Section>}

          {activeSection === 'security' && <Section title="Change Password" icon={Lock}>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <FieldRow label="Current Password">
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                className="form-input pr-9"
                value={passwordForm.old_password}
                onChange={e => setPasswordForm(f => ({ ...f, old_password: e.target.value }))}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setShowOld(v => !v)}
                tabIndex={-1}
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FieldRow>
          <FieldRow label="New Password">
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="form-input pr-9"
                value={passwordForm.new_password}
                onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setShowNew(v => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="form-help mt-1">Minimum 8 characters.</p>
          </FieldRow>
          <FieldRow label="Confirm New Password">
            <input
              type={showNew ? 'text' : 'password'}
              className="form-input"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </FieldRow>

          <div className="flex justify-end pt-2 border-t border-[var(--border)]">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={passwordMutation.isPending}
            >
              {passwordMutation.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
          </Section>}

          {activeSection === 'depot' && <Section title="Depot Information" icon={Building2}>
        {depot ? (
          <div className="space-y-3">
            <FieldRow label="Depot Name">
              <p className="text-sm text-[var(--text-primary)] font-medium">{depot.name}</p>
            </FieldRow>
            <FieldRow label="Location">
              <p className="text-sm text-[var(--text-secondary)]">{depot.location || '—'}</p>
            </FieldRow>
            <FieldRow label="Contact">
              <p className="text-sm text-[var(--text-secondary)]">{depot.contact_number || '—'}</p>
            </FieldRow>
          </div>
        ) : authUser?.is_superuser ? (
          <p className="text-sm text-[var(--text-muted)]">Super admin — not assigned to a specific depot.</p>
        ) : (
          <div className="skeleton h-20 rounded" />
        )}
          </Section>}

          {activeSection === 'account' && <Section title="Account" icon={Shield}>
        <div className="space-y-3">
          <FieldRow label="Role">
            <span className={`badge ${authUser?.is_superuser ? 'badge-accent' : 'badge-primary'}`}>
              {authUser?.is_superuser ? 'Super Admin' : authUser?.role}
            </span>
          </FieldRow>
          <FieldRow label="Account Status">
            <span className="badge badge-success">Active</span>
          </FieldRow>
          <FieldRow label="Member Since">
            <p className="text-sm text-[var(--text-secondary)]">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </p>
          </FieldRow>
        </div>
          </Section>}
        </div>
      </div>
    </div>
  )
}
