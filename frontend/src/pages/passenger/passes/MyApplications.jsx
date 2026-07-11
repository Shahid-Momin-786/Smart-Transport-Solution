import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { passApplicationService } from '@/services/services'
import {
  FileText, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Upload, Eye, Calendar,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'var(--warning)', bg: '#fef3c7', icon: Clock, badge: 'badge-warning' },
  UNDER_VERIFICATION: { label: 'Under Review', color: '#7c3aed', bg: '#ede9fe', icon: Eye, badge: 'badge-accent' },
  APPROVED: { label: 'Approved', color: 'var(--success)', bg: 'var(--success-light)', icon: CheckCircle, badge: 'badge-success' },
  REJECTED: { label: 'Rejected', color: 'var(--danger)', bg: 'var(--danger-light)', icon: XCircle, badge: 'badge-danger' },
  REUPLOAD_REQUESTED: { label: 'Docs Required', color: '#d97706', bg: '#fef3c7', icon: AlertCircle, badge: 'badge-warning' },
}

const DOC_LABELS = {
  AADHAAR: 'Aadhaar Card', BONAFIDE: 'Bonafide Certificate',
  PHOTO: 'Passport Photo', LIGHT_BILL: 'Light Bill',
  EMPLOYEE_ID: 'Employee ID', AGE_PROOF: 'Age Proof',
  DISABILITY_CERT: 'Disability Certificate',
}

const CATEGORY_COLORS = {
  STUDENT: '#2563eb', WORKER: '#7c3aed', SENIOR_CITIZEN: '#d97706',
  GENERAL: '#059669', DISABLED: '#dc2626',
}

function ApplicationCard({ app }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING
  const StatusIcon = cfg.icon
  const catColor = CATEGORY_COLORS[app.category] || 'var(--primary)'

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer',
      }} onClick={() => setExpanded(e => !e)}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${catColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={20} style={{ color: catColor }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {app.application_number}
            </span>
            <span className={`badge ${cfg.badge}`} style={{ fontSize: 10 }}>
              <StatusIcon size={10} style={{ display: 'inline', marginRight: 3 }} />
              {cfg.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            <span style={{ fontWeight: 600, color: catColor }}>{app.category_display}</span>
            {' · '}{app.duration_display}
            {' · '}{app.depot_name}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {app.calculated_price > 0 ? `₹${app.calculated_price}` : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
          </div>
        </div>

        <div style={{ flexShrink: 0, color: 'var(--text-subtle)' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>

          {/* Admin remark */}
          {app.admin_remark && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 14,
              background: app.status === 'APPROVED' ? 'var(--success-light)' : app.status === 'REJECTED' ? 'var(--danger-light)' : '#fef3c7',
              border: `1px solid ${cfg.color}30`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin Remark
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{app.admin_remark}</div>
            </div>
          )}

          {/* Documents submitted */}
          {app.documents?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Documents ({app.documents.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {app.documents.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, padding: '4px 10px',
                      background: 'var(--surface-2)', color: 'var(--text-primary)',
                      borderRadius: 6, border: '1px solid var(--border)',
                      textDecoration: 'none',
                    }}
                  >
                    <FileText size={11} style={{ color: 'var(--primary)' }} />
                    {DOC_LABELS[doc.doc_type] || doc.doc_type}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {app.verification_logs?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Activity Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {app.verification_logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.action_display}
                        {log.admin_name && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> by {log.admin_name}</span>}
                      </div>
                      {log.remark && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{log.remark}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 2 }}>
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {app.status === 'REUPLOAD_REQUESTED' && (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/passes/apply')}
              >
                <Upload size={13} /> Re-upload Documents
              </button>
            </div>
          )}

          {app.has_generated_pass && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/passes/my')}>
                <Eye size={13} /> View Generated Pass
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'UNDER_VERIFICATION', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'REUPLOAD_REQUESTED', label: 'Docs Required' },
]

export default function MyApplications() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => passApplicationService.myList({ page_size: 50 }).then(r => r.data),
  })

  const applications = (data?.results || []).filter(
    a => !statusFilter || a.status === statusFilter
  )

  const pendingCount = (data?.results || []).filter(a => a.status === 'PENDING').length
  const reuploadCount = (data?.results || []).filter(a => a.status === 'REUPLOAD_REQUESTED').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-subtitle">
            {data?.count || 0} applications
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {reuploadCount > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} />
          <span>{reuploadCount} application{reuploadCount > 1 ? 's' : ''} require{reuploadCount === 1 ? 's' : ''} document re-upload.</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            className={`filter-tab ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '48px 0' }}>
            <FileText size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No applications found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {statusFilter ? `No ${statusFilter.toLowerCase().replace('_', ' ')} applications` : 'You have not applied for any pass yet'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {applications.map(app => <ApplicationCard key={app.id} app={app} />)}
        </div>
      )}
    </div>
  )
}
