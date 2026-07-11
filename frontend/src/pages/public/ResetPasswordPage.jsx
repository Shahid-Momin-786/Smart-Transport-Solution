import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { authService } from '@/services/services'
import toast from 'react-hot-toast'

const schema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    if (!token) return toast.error('Invalid reset link.')
    setLoading(true)
    try {
      await authService.resetPassword({ token, ...data })
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-[var(--secondary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-5 h-5 text-[var(--secondary)]" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Password reset</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Your password has been updated. You can now sign in.</p>
        <button onClick={() => navigate('/')} className="btn btn-primary justify-center w-full">Go to sign in</button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-[var(--danger)]">Invalid or missing reset token.</p>
        <Link to="/forgot-password" className="btn btn-secondary mt-4 justify-center w-full">Request new link</Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-[1.375rem] font-semibold text-[var(--text-primary)] mb-1">New password</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Choose a strong password for your account</p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="form-group">
          <label className="form-label">New password</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} className={`form-input pr-10 ${errors.new_password ? 'error' : ''}`} placeholder="Min. 8 characters" {...register('new_password')} />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
        </div>
        <div className="form-group">
          <label className="form-label">Confirm password</label>
          <input type="password" className={`form-input ${errors.confirm_password ? 'error' : ''}`} placeholder="Repeat password" {...register('confirm_password')} />
          {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-lg justify-center" disabled={loading}>
          {loading ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}
