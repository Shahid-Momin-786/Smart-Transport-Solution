import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { generatedPassService, passService } from '@/services/services'
import { CreditCard, Download, X, Calendar, Clock, Shield } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

const CATEGORY_GRADIENTS = {
  STUDENT: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0891b2 100%)',
  WORKER: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #7c3aed 100%)',
  SENIOR_CITIZEN: 'linear-gradient(135deg, #451a03 0%, #b45309 50%, #d97706 100%)',
  GENERAL: 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #16a34a 100%)',
  DISABLED: 'linear-gradient(135deg, #450a0a 0%, #b91c1c 50%, #dc2626 100%)',
  // Legacy pass types
  WEEKLY: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 50%, #2563eb 100%)',
  MONTHLY: 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #16a34a 100%)',
}

const CATEGORY_ACCENT = {
  STUDENT: '#22d3ee', WORKER: '#a78bfa', SENIOR_CITIZEN: '#fbbf24',
  GENERAL: '#4ade80', DISABLED: '#fca5a5',
  WEEKLY: '#60a5fa', MONTHLY: '#4ade80',
}

const STATUS_CONFIG = {
  ACTIVE: { badge: 'badge-success', label: 'Active' },
  EXPIRED: { badge: 'badge-secondary', label: 'Expired' },
  REVOKED: { badge: 'badge-danger', label: 'Revoked' },
}

function PassDetailModal({ pass, onClose, isGenerated }) {
  const category = pass.category || pass.pass_type
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.GENERAL
  const accent = CATEGORY_ACCENT[category] || '#4ade80'
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
    doc.text(`${pass.category_display || pass.pass_type} PASS`, 4, 11)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(pass.passenger_name || '', 4, 22)
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
            background: gradient, borderRadius: 'var(--radius-lg)',
            padding: '20px 20px 16px', position: 'relative',
            overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {pass.category_display || pass.pass_type} PASS
                    {isGenerated && ' · APPROVED'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{pass.duration_display || ''}</div>
                </div>
                <span className={`badge ${cfg.badge}`} style={{ fontSize: 9, background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>{pass.passenger_name}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)', marginTop: 2, letterSpacing: '0.1em' }}>
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
                  <div style={{ background: 'white', borderRadius: 6, padding: 3 }}>
                    <img src={`data:image/png;base64,${pass.qr_code}`} alt="QR" style={{ width: 52, height: 52, display: 'block' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Depot', pass.depot_name],
              ['Valid From', pass.valid_from],
              ['Valid To', pass.valid_to],
              ['Price', `₹${pass.price || pass.fare}`],
              pass.route_number ? ['Route', pass.route_number] : null,
              isGenerated && pass.application_number ? ['Application', pass.application_number] : null,
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

function PassCard({ pass, onClick, isGenerated }) {
  const category = pass.category || pass.pass_type
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.GENERAL
  const accent = CATEGORY_ACCENT[category] || '#4ade80'
  const daysLeft = pass.is_valid ? differenceInDays(new Date(pass.valid_to), new Date()) : 0
  const cfg = STATUS_CONFIG[pass.status] || STATUS_CONFIG.EXPIRED

  return (
    <div
      className="pass-metro"
      style={{ background: gradient, opacity: pass.is_valid ? 1 : 0.6, cursor: 'pointer' }}
      onClick={() => onClick(pass)}
    >
      <div className="pass-metro-pattern" />
      <div className="pass-metro-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              {pass.category_display || pass.pass_type} PASS · SMTS
            </div>
            <div className="pass-metro-chip" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'white',
              background: 'rgba(255,255,255,0.15)', borderRadius: 3,
              padding: '2px 6px', textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              {cfg.label}
            </span>
            {isGenerated && (
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                <Shield size={8} style={{ display: 'inline', marginRight: 2 }} />Verified
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="pass-metro-name">{pass.passenger_name}</div>
          <div className="pass-metro-number" style={{ marginTop: 3 }}>{pass.pass_number}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div className="pass-metro-expiry">{pass.valid_from} → {pass.valid_to}</div>
            {pass.is_valid && (
              <div style={{ fontSize: 10, fontWeight: 600, color: accent }}>{daysLeft}d left</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const FILTER_TABS = [
  { key: 'ALL', label: 'All Passes' },
  { key: 'generated', label: 'Verified Passes' },
  { key: 'legacy', label: 'Direct Passes' },
]

export default function MyPasses() {
  const [selected, setSelected] = useState(null)
  const [selectedIsGenerated, setSelectedIsGenerated] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const { data: generatedData, isLoading: loadingGenerated } = useQuery({
    queryKey: ['my-generated-passes'],
    queryFn: () => generatedPassService.myList({ page_size: 50 }).then(r => r.data),
  })

  const { data: legacyData, isLoading: loadingLegacy } = useQuery({
    queryKey: ['my-passes'],
    queryFn: () => passService.myPasses({ page_size: 50 }).then(r => r.data),
  })

  const generatedPasses = generatedData?.results || []
  const legacyPasses = legacyData?.results || []

  const allPasses = [
    ...generatedPasses.map(p => ({ ...p, _isGenerated: true })),
    ...legacyPasses.map(p => ({ ...p, _isGenerated: false })),
  ]

  const displayed = filter === 'ALL' ? allPasses
    : filter === 'generated' ? allPasses.filter(p => p._isGenerated)
    : allPasses.filter(p => !p._isGenerated)

  const activePasses = allPasses.filter(p => p.is_valid)
  const isLoading = loadingGenerated || loadingLegacy

  const handleClick = (pass) => {
    setSelected(pass)
    setSelectedIsGenerated(pass._isGenerated)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Passes</h1>
          <p className="page-subtitle">
            {allPasses.length} passes · {activePasses.length} active
          </p>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        {FILTER_TABS.map(({ key, label }) => (
          <button key={key} className={`filter-tab ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {activePasses.length === 0 && (
        <div className="alert-banner info" style={{ marginBottom: 20 }}>
          <CreditCard size={15} />
          <span>No active passes. Apply for a pass or get a daily pass.</span>
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
      ) : displayed.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CreditCard size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No passes found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Apply for a pass to get started</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(p => (
            <PassCard key={`${p._isGenerated ? 'g' : 'l'}-${p.id}`} pass={p} onClick={handleClick} isGenerated={p._isGenerated} />
          ))}
        </div>
      )}

      {selected && (
        <PassDetailModal
          pass={selected}
          isGenerated={selectedIsGenerated}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
