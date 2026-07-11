import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { userService, authService } from '@/services/services'
import { User, Lock, Camera, Shield, Info, Save, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
})

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

const SETTINGS_NAV = [
  { id: 'profile',  icon: User,    label: 'Profile' },
  { id: 'security', icon: Lock,    label: 'Security' },
  { id: 'about',    icon: Info,    label: 'About' },
]

function ProfileSection({ user, updateUser }) {
  const [showOld, setShowOld] = useState(false)
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', phone: user?.phone || '' },
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data) => userService.me(data),
    onSuccess: (res) => { updateUser(res.data); toast.success('Profile updated.') },
    onError: () => toast.error('Failed to update profile.'),
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (file) => userService.uploadPhoto(file),
    onSuccess: (res) => { updateUser(res.data); toast.success('Photo updated.') },
    onError: () => toast.error('Failed to upload photo.'),
  })

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Avatar section */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Profile Photo</span>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700, overflow: 'hidden',
              border: '3px solid var(--border)',
            }}>
              {user?.profile_image_url
                ? <img src={user.profile_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <label style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              border: '2px solid var(--bg)',
            }}>
              <Camera size={11} style={{ color: 'white' }} />
              <input
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhotoMutation.mutate(f) }}
              />
            </label>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span className="badge badge-primary">{user?.role}</span>
              {user?.depot && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.depot.name}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Personal info form */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Personal Information</span>
        </div>
        <div className="card-body">
          <form
            onSubmit={profileForm.handleSubmit(data => updateProfileMutation.mutate(data))}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className={`form-input ${profileForm.formState.errors.name ? 'error' : ''}`}
                  {...profileForm.register('name')}
                />
                {profileForm.formState.errors.name && (
                  <p className="form-error">{profileForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" value={user?.email || ''} disabled />
                <p className="form-help">Email cannot be changed.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 XXXXX XXXXX"
                  {...profileForm.register('phone')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Depot</label>
                <input type="text" className="form-input" value={user?.depot?.name || 'Not assigned'} disabled />
              </div>

              <div className="form-group">
                <label className="form-label">Member Since</label>
                <input type="text" className="form-input" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} disabled />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn btn-primary" disabled={updateProfileMutation.isPending}>
                <Save size={14} />
                {updateProfileMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function SecuritySection() {
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) })

  const changePasswordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => { toast.success('Password changed successfully.'); passwordForm.reset() },
    onError: (err) => toast.error(err.response?.data?.old_password?.[0] || 'Failed to change password.'),
  })

  const PasswordInput = ({ id, placeholder, show, onToggle, field }) => (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`form-input ${passwordForm.formState.errors[field] ? 'error' : ''}`}
        placeholder={placeholder}
        style={{ paddingRight: 40 }}
        {...passwordForm.register(field)}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          padding: 0, display: 'flex',
        }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Change Password</span>
        </div>
        <div className="card-body">
          <div style={{ padding: '10px 12px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', border: '1px solid rgba(217,119,6,0.2)', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Shield size={14} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.5 }}>
              Use a strong password with at least 8 characters, including numbers and symbols.
            </div>
          </div>
          <form
            onSubmit={passwordForm.handleSubmit(data => changePasswordMutation.mutate(data))}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <PasswordInput
                id="old_password" field="old_password"
                placeholder="Enter current password"
                show={showOld} onToggle={() => setShowOld(s => !s)}
              />
              {passwordForm.formState.errors.old_password && (
                <p className="form-error">{passwordForm.formState.errors.old_password.message}</p>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div className="form-group">
              <label className="form-label">New Password</label>
              <PasswordInput
                id="new_password" field="new_password"
                placeholder="Min. 8 characters"
                show={showNew} onToggle={() => setShowNew(s => !s)}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="form-error">{passwordForm.formState.errors.new_password.message}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <PasswordInput
                id="confirm_password" field="confirm_password"
                placeholder="Re-enter new password"
                show={showConfirm} onToggle={() => setShowConfirm(s => !s)}
              />
              {passwordForm.formState.errors.confirm_password && (
                <p className="form-error">{passwordForm.formState.errors.confirm_password.message}</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn btn-primary" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AboutSection({ user }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Account Information</span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          ['Account ID', user?.id || '—'],
          ['Full Name', user?.name || '—'],
          ['Email', user?.email || '—'],
          ['Role', user?.role || '—'],
          ['Depot', user?.depot?.name || 'Not assigned'],
          ['Account Status', user?.is_active ? 'Active' : 'Inactive'],
          ['Member Since', user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, fontFamily: ['Account ID'].includes(label) ? 'monospace' : 'inherit' }}>
              {val}
            </span>
          </div>
        ))}
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center' }}>
            Smart Transport Solution · Version 1.0.0 · © 2026
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PassengerProfile() {
  const { user, updateUser } = useAuth()
  const [activeSection, setActiveSection] = useState('profile')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Settings</h1>
          <p className="page-subtitle">Manage your profile, security, and preferences</p>
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
          {activeSection === 'profile' && <ProfileSection user={user} updateUser={updateUser} />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'about' && <AboutSection user={user} />}
        </div>
      </div>
    </div>
  )
}
