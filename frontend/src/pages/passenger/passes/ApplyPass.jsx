import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { passApplicationService, passDocumentService, depotService, routeService, passPricingService } from '@/services/services'
import {
  CheckCircle, ChevronRight, Upload, X, FileText,
  User, Briefcase, Clock, Heart, Accessibility,
  ArrowRight, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

const STEPS = ['Select Category', 'Upload Documents', 'Review', 'Submit']

const CATEGORIES = [
  { key: 'STUDENT', label: 'Student', icon: User, color: '#2563eb', desc: 'For enrolled students with bonafide certificate' },
  { key: 'WORKER', label: 'Worker', icon: Briefcase, color: '#7c3aed', desc: 'For working professionals with employee ID' },
  { key: 'SENIOR_CITIZEN', label: 'Senior Citizen', icon: Clock, color: '#d97706', desc: 'For citizens aged 60 and above' },
  { key: 'GENERAL', label: 'General Passenger', icon: User, color: '#059669', desc: 'For general public passengers' },
  { key: 'DISABLED', label: 'Disabled Passenger', icon: Accessibility, color: '#dc2626', desc: 'For passengers with disability certificate' },
]

const DURATIONS = [
  { key: 'MONTHLY', label: 'Monthly', months: 1 },
  { key: '3MONTHS', label: '3 Months', months: 3 },
  { key: '6MONTHS', label: '6 Months', months: 6 },
  { key: 'YEARLY', label: 'Yearly', months: 12 },
]

const DOC_LABELS = {
  AADHAAR: 'Aadhaar Card',
  BONAFIDE: 'Bonafide Certificate',
  PHOTO: 'Passport Photo',
  LIGHT_BILL: 'Light Bill',
  EMPLOYEE_ID: 'Employee ID',
  AGE_PROOF: 'Age Proof',
  DISABILITY_CERT: 'Disability Certificate',
}

const REQUIRED_DOCS = {
  STUDENT: ['AADHAAR', 'BONAFIDE', 'PHOTO'],
  WORKER: ['AADHAAR', 'LIGHT_BILL', 'EMPLOYEE_ID', 'PHOTO'],
  SENIOR_CITIZEN: ['AADHAAR', 'AGE_PROOF'],
  DISABLED: ['AADHAAR', 'DISABILITY_CERT'],
  GENERAL: ['AADHAAR', 'LIGHT_BILL'],
}

export default function ApplyPass() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    category: '',
    duration: '',
    depot: '',
    route: '',
    area: '',
  })
  const [uploadedFiles, setUploadedFiles] = useState({}) // { DOC_TYPE: File }
  const [createdAppId, setCreatedAppId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState(false)

  const { data: depotsData } = useQuery({
    queryKey: ['depots-list'],
    queryFn: () => depotService.list({ page_size: 50 }).then(r => r.data),
  })
  const { data: routesData } = useQuery({
    queryKey: ['routes-list'],
    queryFn: () => routeService.list({ page_size: 100 }).then(r => r.data),
  })
  const { data: pricingData } = useQuery({
    queryKey: ['pass-pricing', form.category, form.duration, form.depot],
    queryFn: () => passPricingService.list({
      category: form.category || undefined,
      duration: form.duration || undefined,
    }).then(r => r.data),
    enabled: !!(form.category && form.duration),
  })

  const depots = depotsData?.results || []
  const routes = routesData?.results || []
  const pricing = pricingData?.results || []

  const selectedCategory = CATEGORIES.find(c => c.key === form.category)
  const selectedDuration = DURATIONS.find(d => d.key === form.duration)
  const requiredDocs = form.category ? REQUIRED_DOCS[form.category] || [] : []

  // Find best matching price
  const matchedPrice = pricing.find(p =>
    p.category === form.category &&
    p.duration === form.duration &&
    (p.depot === Number(form.depot) || p.depot === null)
  )

  const handleFileChange = (docType, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${DOC_LABELS[docType]}: File must be under 5MB`)
      return
    }
    setUploadedFiles(prev => ({ ...prev, [docType]: file }))
  }

  const removeFile = (docType) => {
    setUploadedFiles(prev => {
      const next = { ...prev }
      delete next[docType]
      return next
    })
  }

  const allDocsUploaded = requiredDocs.every(d => uploadedFiles[d])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Step 1: Create application
      const res = await passApplicationService.create({
        category: form.category,
        duration: form.duration,
        depot: Number(form.depot),
        route: form.route ? Number(form.route) : undefined,
        area: form.area,
      })
      const appId = res.data.id
      setCreatedAppId(appId)

      // Step 2: Upload docs
      setUploadingDocs(true)
      for (const [docType, file] of Object.entries(uploadedFiles)) {
        await passDocumentService.upload(appId, docType, file)
      }

      toast.success('Application submitted successfully!')
      setStep(3)
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Submission failed.')
    } finally {
      setSubmitting(false)
      setUploadingDocs(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Apply for Pass</h1>
          <p className="page-subtitle">Long-term transport pass with admin verification</p>
        </div>
      </div>

      {/* Step indicator */}
      {step < 3 && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, overflowX: 'auto' }}>
          {STEPS.slice(0, 3).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: i < step ? 'var(--success)' : i === step ? 'var(--primary)' : 'var(--surface-2)',
                  color: i <= step ? 'white' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i === step ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {s}
                </span>
              </div>
              {i < 2 && <ChevronRight size={14} style={{ color: 'var(--text-subtle)', margin: '0 8px', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 0: Select Category + Details ── */}
      {step === 0 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pass Category
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ marginBottom: 24 }}>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                const isSelected = form.category === cat.key
                return (
                  <div
                    key={cat.key}
                    onClick={() => setForm(f => ({ ...f, category: cat.key }))}
                    style={{
                      padding: 16, borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${isSelected ? cat.color : 'var(--border)'}`,
                      background: isSelected ? `${cat.color}08` : 'var(--surface)',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: isSelected ? `${cat.color}20` : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} style={{ color: isSelected ? cat.color : 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? cat.color : 'var(--text-primary)', marginBottom: 3 }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{cat.desc}</div>
                    </div>
                    {isSelected && <CheckCircle size={16} style={{ color: cat.color, marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>

            {form.category && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Duration
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  {DURATIONS.map(dur => (
                    <button
                      key={dur.key}
                      onClick={() => setForm(f => ({ ...f, duration: dur.key }))}
                      style={{
                        padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${form.duration === dur.key ? 'var(--primary)' : 'var(--border)'}`,
                        background: form.duration === dur.key ? 'var(--primary-light)' : 'var(--surface)',
                        color: form.duration === dur.key ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Depot *</label>
                    <select className="form-input" value={form.depot} onChange={e => setForm(f => ({ ...f, depot: e.target.value }))}>
                      <option value="">Select depot…</option>
                      {depots.map(d => <option key={d.id} value={d.id}>{d.name} — {d.city}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Route (optional)</label>
                    <select className="form-input" value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))}>
                      <option value="">Any route</option>
                      {routes.map(r => <option key={r.id} value={r.id}>{r.route_number} — {r.source} → {r.destination}</option>)}
                    </select>
                  </div>
                </div>

                {/* Price preview */}
                {form.category && form.duration && (
                  <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>
                          {selectedCategory?.label} · {selectedDuration?.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimated price (subject to admin confirmation)</div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
                        {matchedPrice ? `₹${matchedPrice.price}` : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={!form.category || !form.duration || !form.depot}
            onClick={() => setStep(1)}
          >
            Next: Upload Documents <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ── Step 1: Document Upload ── */}
      {step === 1 && (
        <div style={{ maxWidth: 600 }}>
          <div className="alert-banner info" style={{ marginBottom: 20 }}>
            <FileText size={14} />
            <span>Upload the following documents for {selectedCategory?.label} pass. Max 5MB per file.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {requiredDocs.map(docType => {
              const file = uploadedFiles[docType]
              return (
                <div key={docType} style={{
                  padding: 16, borderRadius: 12,
                  border: `2px solid ${file ? 'var(--success)' : 'var(--border)'}`,
                  background: file ? 'var(--success-light)' : 'var(--surface)',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: file ? 'var(--success)' : 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {file ? <CheckCircle size={16} style={{ color: 'white' }} /> : <FileText size={16} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{DOC_LABELS[docType]}</div>
                        {file && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {file && (
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeFile(docType)} title="Remove">
                          <X size={13} style={{ color: 'var(--danger)' }} />
                        </button>
                      )}
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                        <Upload size={13} /> {file ? 'Change' : 'Upload'}
                        <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={e => handleFileChange(docType, e.target.files[0])} />
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" disabled={!allDocsUploaded} onClick={() => setStep(2)}>
              Next: Review <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              Application Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Category', selectedCategory?.label],
                ['Duration', selectedDuration?.label],
                ['Depot', depots.find(d => d.id === Number(form.depot))?.name],
                form.route ? ['Route', routes.find(r => r.id === Number(form.route))?.route_number] : null,
                matchedPrice ? ['Estimated Price', `₹${matchedPrice.price}`] : null,
                ['Documents', `${Object.keys(uploadedFiles).length} / ${requiredDocs.length} uploaded`],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Documents to Submit
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.keys(uploadedFiles).map(docType => (
                  <span key={docType} style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px',
                    background: 'var(--success-light)', color: 'var(--success)',
                    borderRadius: 6, border: '1px solid var(--success)',
                  }}>
                    <CheckCircle size={10} style={{ display: 'inline', marginRight: 4 }} />
                    {DOC_LABELS[docType]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="alert-banner info" style={{ marginBottom: 16 }}>
            <Eye size={14} />
            <span>Your application will be reviewed by the depot admin. You'll be notified of the status.</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (uploadingDocs ? 'Uploading documents…' : 'Submitting…') : 'Submit Application'}
              {!submitting && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 3 && (
        <div style={{ maxWidth: 480 }}>
          <div style={{
            textAlign: 'center', padding: '40px 24px',
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--success-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Application Submitted!
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              Your {selectedCategory?.label} pass application has been submitted successfully.
              The depot admin will review your documents and notify you.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/passes/applications')}>
                View My Applications
              </button>
              <button className="btn btn-primary" onClick={() => {
                setStep(0)
                setForm({ category: '', duration: '', depot: '', route: '', area: '' })
                setUploadedFiles({})
                setCreatedAppId(null)
              }}>
                Apply Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
