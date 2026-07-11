import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { passApplicationService, generatedPassService, passService, passPricingService, userService } from '@/services/services'
import {
  FileText, CheckCircle, XCircle, Clock, Eye, Download,
  Search, Shield, AlertCircle, Plus, X, Ban, ChevronDown,
  ChevronUp, Settings, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING: { label: 'Pending', badge: 'badge-warning', icon: Clock, color: '#d97706' },
  UNDER_VERIFICATION: { label: 'Under Review', badge: 'badge-accent', icon: Eye, color: '#7c3aed' },
  APPROVED: { label: 'Approved', badge: 'badge-success', icon: CheckCircle, color: 'var(--success)' },
  REJECTED: { label: 'Rejected', badge: 'badge-danger', icon: XCircle, color: 'var(--danger)' },
  REUPLOAD_REQUESTED: { label: 'Docs Required', badge: 'badge-warning', icon: AlertCircle, color: '#d97706' },
}

const DOC_LABELS = {
  AADHAAR: 'Aadhaar Card', BONAFIDE: 'Bonafide Certificate',
  PHOTO: 'Passport Photo', LIGHT_BILL: 'Light Bill',
  EMPLOYEE_ID: 'Employee ID', AGE_PROOF: 'Age Proof',
  DISABILITY_CERT: 'Disability Certificate',
}

// ── Application Detail Modal ──────────────────────────────────────────────────
function ApplicationModal({ app, onClose }) {
  const [action, setAction] = useState('')
  const [remark, setRemark] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0])
  const queryClient = useQueryClient()

  const reviewMutation = useMutation({
    mutationFn: (data) => passApplicationService.review(app.id, data),
    onSuccess: () => {
      toast.success('Application updated.')
      queryClient.invalidateQueries(['admin-applications'])
      onClose()
    },
    onError: (err) => {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Action failed.')
    },
  })

  const handleAction = () => {
    if (action === 'reject' && !remark.trim()) {
      toast.error('Rejection reason is required.')
      return
    }
    reviewMutation.mutate({ action, remark, valid_from: validFrom })
  }

  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Application — {app.application_number}
            </h3>
            <span className={`badge ${cfg.badge}`} style={{ marginTop: 4, fontSize: 10 }}>
              {cfg.label}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Passenger info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
            {[
              ['Passenger', app.passenger_name],
              ['Email', app.passenger_email],
              ['Phone', app.passenger_phone || '—'],
              ['Depot', app.depot_name],
              ['Category', app.category_display],
              ['Duration', app.duration_display],
              ['Route', app.route_number || '—'],
              ['Price', app.calculated_price > 0 ? `₹${app.calculated_price}` : '—'],
              ['Applied', formatDistanceToNow(new Date(app.created_at), { addSuffix: true })],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Documents */}
          {app.documents?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Submitted Documents ({app.documents.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {app.documents.map(doc => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'var(--surface)', borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={14} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {DOC_LABELS[doc.doc_type] || doc.doc_type}
                      </span>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none', gap: 5 }}
                    >
                      <Download size={12} /> View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification logs */}
          {app.verification_logs?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Activity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {app.verification_logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.action_display}
                        {log.admin_name && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> by {log.admin_name}</span>}
                      </div>
                      {log.remark && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.remark}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 1 }}>
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin action */}
          {!['APPROVED', 'REJECTED'].includes(app.status) && (
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Take Action
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { key: 'start_review', label: 'Start Review', color: '#7c3aed' },
                  { key: 'approve', label: 'Approve', color: 'var(--success)' },
                  { key: 'reject', label: 'Reject', color: 'var(--danger)' },
                  { key: 'request_reupload', label: 'Request Re-upload', color: '#d97706' },
                ].map(a => (
                  <button
                    key={a.key}
                    onClick={() => setAction(a.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${action === a.key ? a.color : 'var(--border)'}`,
                      background: action === a.key ? `${a.color}15` : 'var(--surface)',
                      color: action === a.key ? a.color : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {action === 'approve' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Pass Valid From</label>
                  <input type="date" className="form-input" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                </div>
              )}

              {(action === 'reject' || action === 'request_reupload') && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">
                    {action === 'reject' ? 'Rejection Reason *' : 'Instructions for Passenger'}
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder={action === 'reject' ? 'Explain why the application was rejected…' : 'What documents are needed…'}
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}

              {action === 'start_review' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Remark (optional)</label>
                  <input className="form-input" placeholder="Optional note…" value={remark} onChange={e => setRemark(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          {action && (
            <button
              className="btn btn-primary btn-sm"
              disabled={reviewMutation.isPending}
              onClick={handleAction}
            >
              {reviewMutation.isPending ? 'Processing…' : 'Confirm Action'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pricing Manager ───────────────────────────────────────────────────────────
function PricingManager({ onClose }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-pricing'],
    queryFn: () => passPricingService.list({ page_size: 100 }).then(r => r.data),
  })
  const [form, setForm] = useState({ category: 'STUDENT', duration: 'MONTHLY', price: '' })

  const createMutation = useMutation({
    mutationFn: (data) => passPricingService.create(data),
    onSuccess: () => { toast.success('Price added.'); queryClient.invalidateQueries(['admin-pricing']) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => passPricingService.delete(id),
    onSuccess: () => { toast.success('Price removed.'); queryClient.invalidateQueries(['admin-pricing']) },
  })

  const pricing = data?.results || []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Pass Pricing Management</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Add new price */}
          <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, marginBottom: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Price</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {[['STUDENT', 'Student'], ['WORKER', 'Worker'], ['SENIOR_CITIZEN', 'Senior Citizen'], ['GENERAL', 'General'], ['DISABLED', 'Disabled']].map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="form-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                  {[['MONTHLY', 'Monthly'], ['3MONTHS', '3 Months'], ['6MONTHS', '6 Months'], ['YEARLY', 'Yearly']].map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price (₹)</label>
                <input type="number" className="form-input" placeholder="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ opacity: 0 }}>Add</label>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!form.price || createMutation.isPending}
                  onClick={() => createMutation.mutate({ category: form.category, duration: form.duration, price: Number(form.price) })}
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Pricing table */}
          {pricing.length > 0 && (
            <table className="table">
              <thead>
                <tr><th>Category</th><th>Duration</th><th>Depot</th><th>Price</th><th></th></tr>
              </thead>
              <tbody>
                {pricing.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{p.category_display}</td>
                    <td style={{ fontSize: 12 }}>{p.duration_display}</td>
                    <td style={{ fontSize: 12 }}>{p.depot_name || 'Global'}</td>
                    <td style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>₹{p.price}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => { if (confirm('Remove this price?')) deleteMutation.mutate(p.id) }}
                      >
                        <X size={13} style={{ color: 'var(--danger)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Issue Pass Modal (backward compat) ────────────────────────────────────────
function IssuePassModal({ onClose }) {
  const [form, setForm] = useState({ passenger: '', pass_type: 'MONTHLY', valid_from: '', student_id: '' })
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data: usersData } = useQuery({
    queryKey: ['passengers-all'],
    queryFn: () => userService.list({ role: 'PASSENGER', page_size: 200 }).then(r => r.data.results),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await passService.create(form)
      toast.success('Pass issued.')
      queryClient.invalidateQueries(['admin-passes'])
      onClose()
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Failed to issue pass.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Issue Pass Directly</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="form-group">
              <label className="form-label">Passenger *</label>
              <select className="form-input" value={form.passenger} onChange={e => setForm(f => ({ ...f, passenger: e.target.value }))} required>
                <option value="">Select passenger…</option>
                {usersData?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Pass Type</label>
                <select className="form-input" value={form.pass_type} onChange={e => setForm(f => ({ ...f, pass_type: e.target.value }))}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="STUDENT">Student</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valid From *</label>
                <input type="date" className="form-input" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} required />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Issuing…' : 'Issue Pass'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Admin Passes Page ─────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: '', label: 'All', count: null },
  { key: 'PENDING', label: 'Pending', count: null },
  { key: 'UNDER_VERIFICATION', label: 'Under Review', count: null },
  { key: 'APPROVED', label: 'Approved', count: null },
  { key: 'REJECTED', label: 'Rejected', count: null },
]

export default function AdminPasses() {
  const [activeTab, setActiveTab] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApp, setSelectedApp] = useState(null)
  const [showPricing, setShowPricing] = useState(false)
  const [showIssue, setShowIssue] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications', activeTab, search, page],
    queryFn: () => passApplicationService.list({
      status: activeTab || undefined,
      search: search || undefined,
      page,
      page_size: 15,
    }).then(r => r.data),
  })

  // Count badges for tabs
  const { data: countData } = useQuery({
    queryKey: ['admin-applications-counts'],
    queryFn: async () => {
      const statuses = ['PENDING', 'UNDER_VERIFICATION', 'APPROVED', 'REJECTED']
      const counts = {}
      await Promise.all(statuses.map(async s => {
        const r = await passApplicationService.list({ status: s, page_size: 1 })
        counts[s] = r.data.count || 0
      }))
      return counts
    },
    refetchInterval: 30000,
  })

  const applications = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pass Verification</h1>
          <p className="page-subtitle">Review and approve pass applications from your depot</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPricing(true)}>
            <Settings size={13} /> Pricing
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowIssue(true)}>
            <Plus size={13} /> Issue Pass
          </button>
        </div>
      </div>

      {/* Stats row */}
      {countData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
          {[
            { label: 'Pending', count: countData.PENDING, color: '#d97706', bg: '#fef3c7' },
            { label: 'Under Review', count: countData.UNDER_VERIFICATION, color: '#7c3aed', bg: '#ede9fe' },
            { label: 'Approved', count: countData.APPROVED, color: 'var(--success)', bg: 'var(--success-light)' },
            { label: 'Rejected', count: countData.REJECTED, color: 'var(--danger)', bg: 'var(--danger-light)' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={18} style={{ color }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="filter-tabs" style={{ flex: 1 }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              className={`filter-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setPage(1) }}
            >
              {tab.label}
              {countData && tab.key && countData[tab.key] > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 9, fontWeight: 700,
                  background: activeTab === tab.key ? 'var(--primary)' : 'var(--surface-2)',
                  color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                  padding: '1px 5px', borderRadius: 8,
                }}>
                  {countData[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            className="form-input search-input"
            style={{ width: 220 }}
            placeholder="Search applications…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 6 }} />)}
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 0' }}>
            <FileText size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No applications found</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Passenger</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Docs</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING
                const StatusIcon = cfg.icon
                return (
                  <tr key={app.id}>
                    <td className="font-mono text-xs" style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 11 }}>
                      {app.application_number}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{app.passenger_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.passenger_email}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{app.category_display}</td>
                    <td style={{ fontSize: 12 }}>{app.duration_display}</td>
                    <td style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                      {app.calculated_price > 0 ? `₹${app.calculated_price}` : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{app.documents?.length || 0}</td>
                    <td>
                      <span className={`badge ${cfg.badge}`} style={{ fontSize: 10 }}>
                        <StatusIcon size={9} style={{ display: 'inline', marginRight: 3 }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedApp(app)}
                        style={{ gap: 5 }}
                      >
                        <Eye size={12} /> Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {data?.total_pages > 1 && (
          <div className="pagination justify-end">
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 12px' }}>{page} / {data.total_pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {selectedApp && <ApplicationModal app={selectedApp} onClose={() => setSelectedApp(null)} />}
      {showPricing && <PricingManager onClose={() => setShowPricing(false)} />}
      {showIssue && <IssuePassModal onClose={() => setShowIssue(false)} />}
    </div>
  )
}
