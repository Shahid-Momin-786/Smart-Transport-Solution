import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { passService } from '@/services/services'
import { CreditCard, Download, X, Calendar, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

const PASS_GRADIENTS = {
  WEEKLY:  'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #2563eb 100%)',
  MONTHLY: 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #16a34a 100%)',
  STUDENT: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0891b2 100%)',
}

const PASS_ACCENT = {
  WEEKLY:  '#60a5fa',
  MONTHLY: '#4ade80',
  STUDENT: '#22d3ee',
}

const STATUS_CONFIG = {
  ACTIVE:  { badge: 'badge-success', label: 'Active' },
  EXPIRED: { badge: 'badge-secondary', label: 'Expired' },
  REVOKED: { badge: 'badge-danger', label: 'Revoked' },
}

function PassDetailModal({ pass, onClose }) {
  const gradient = PASS_GRADIENTS[pass.pass_type] || PASS_GRADIENTS.WEEKLY
  const accent = PASS_ACCENT[pass.pass_type] || PASS_ACCENT.WEEKLY
  const daysLeft = pass.is_valid ? differenceInDays(new Date(pass.valid_to), new Date()) : 0
  const cfg = STATUS_CONFIG[pass.status] || STATUS_CONFIG.EXPIRED

  const downloadPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [86, 54] })
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 86, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('SMART TRANSPORT SOLUTION', 4, 6)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`${pass.pass_type} PASS`, 4, 11)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(pass.passenger_name, 4, 22)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(`Pass ID: ${pass.pass_number}`, 4, 28)
    doc.text(`Valid: ${pass.valid_from} to ${pass.valid_to}`, 4, 33)
    doc.text(`Depot: ${pass.depot_name}`, 4, 38)
    if (pass.qr_code) {
      try { doc.addImage(`data:image/png;base64,${pass.qr_code}`, 'PNG', 60, 16, 22, 22) } catch {}
    }
    doc.save(`${pass.pass_number}.pdf`)
    toast.success('Pass PDF downloaded!')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Pass Details</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">
          {/* Metro card */}
          <div style={{
            background: gradient,
            borderRadius: 'var(--radius-lg)',
            padding: '20px 20px 16px',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: 16,
          }}>
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 120, height: 120,
              borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
            }} />
            <div style={{
              position: 'absolute', bottom: -20, left: -20, width: 80, height: 80,
              borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: `${accent}`, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {pass.pass_type} PASS
                  </div>
                  <div style={{ width: 32, height: 24, background: 'rgba(255,255,255,0.2)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)' }} />
                </div>
                <span className={`badge ${cfg.badge}`} style={{ fontSize: 9, background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>
                  {cfg.label}
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{pass.passenger_name}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', marginTop: 2 }}>
                  {pass.pass_number}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>Valid Until</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{pass.valid_to}</div>
                  {pass.is_valid && (
                    <div style={{ fontSize: 10, color: accent, marginTop: 2, fontWeight: 500 }}>
                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                    </div>
                  )}
                </div>
                {pass.qr_code && (
                  <div style={{
                    background: 'white', borderRadius: 6, padding: 3,
                  }}>
                    <img src={`data:image/png;base64,${pass.qr_code}`} alt="QR" style={{ width: 52, height: 52, display: 'block' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Email', pass.passenger_email],
              ['Depot', pass.depot_name],
              ['Valid From', pass.valid_from],
              ['Valid To', pass.valid_to],
              ['Fare', `₹${pass.fare}`],
              pass.student_id ? ['Student ID', pass.student_id] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={downloadPDF}>
            <Download size={13} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}

function PassCard({ pass, onClick }) {
  const gradient = PASS_GRADIENTS[pass.pass_type] || PASS_GRADIENTS.WEEKLY
  const accent = PASS_ACCENT[pass.pass_type] || PASS_ACCENT.WEEKLY
  const daysLeft = pass.is_valid ? differenceInDays(new Date(pass.valid_to), new Date()) : 0
  const cfg = STATUS_CONFIG[pass.status] || STATUS_CONFIG.EXPIRED

  return (
    <div
      className="pass-metro"
      style={{ background: gradient, opacity: pass.is_valid ? 1 : 0.6 }}
      onClick={() => onClick(pass)}
    >
      <div className="pass-metro-pattern" />
      <div className="pass-metro-body">
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              {pass.pass_type} PASS · SMTS
            </div>
            <div className="pass-metro-chip" />
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'white',
            background: 'rgba(255,255,255,0.15)', borderRadius: 3,
            padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            {cfg.label}
          </span>
        </div>

        {/* Bottom row */}
        <div>
          <div className="pass-metro-name">{pass.passenger_name}</div>
          <div className="pass-metro-number" style={{ marginTop: 3 }}>{pass.pass_number}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div className="pass-metro-expiry">
              {pass.valid_from} → {pass.valid_to}
            </div>
            {pass.is_valid && (
              <div style={{ fontSize: 10, fontWeight: 600, color: accent }}>
                {daysLeft}d left
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const FILTER_TABS = [
  { key: 'ALL', label: 'All Passes' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'STUDENT', label: 'Student' },
]

export default function PassengerPasses() {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['my-passes'],
    queryFn: () => passService.myPasses({ page_size: 50 }).then(r => r.data),
  })

  const passes = (data?.results || []).filter(p => filter === 'ALL' || p.pass_type === filter)
  const activePasses = (data?.results || []).filter(p => p.is_valid)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Passes</h1>
          <p className="page-subtitle">
            {data?.count || 0} passes · {activePasses.length} active
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
        <div className="filter-tabs">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`filter-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pass info banner */}
      {activePasses.length === 0 && (
        <div className="alert-banner info" style={{ marginBottom: 20 }}>
          <CreditCard size={15} />
          <span>You don't have any active passes. Contact your depot admin to request a pass.</span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} style={{ aspectRatio: '1.586/1' }}>
              <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-lg)' }} />
            </div>
          ))}
        </div>
      ) : passes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CreditCard size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No passes found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {filter !== 'ALL' ? `No ${filter.toLowerCase()} passes yet` : 'Contact your depot admin'}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {passes.map(p => (
            <PassCard key={p.id} pass={p} onClick={setSelected} />
          ))}
        </div>
      )}

      {selected && <PassDetailModal pass={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
