import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dailyPassService, depotService, routeService } from '@/services/services'
import {
  MapPin, Bus, CreditCard, CheckCircle, Download,
  ArrowRight, ChevronRight, QrCode, X, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { format } from 'date-fns'

const STEPS = ['Select Route', 'Choose Pass', 'Confirm & Pay', 'Your Pass']

const PASS_OPTIONS = [
  {
    type: 'CITY',
    label: 'City Pass',
    price: 70,
    description: 'Unlimited rides within city limits',
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    features: ['All city routes', 'Unlimited boardings', 'Valid for today'],
  },
  {
    type: 'EXTENDED',
    label: 'Extended Area Pass',
    price: 150,
    description: 'City + extended suburban coverage',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)',
    features: ['All city routes', 'Suburban routes', 'Extended area', 'Valid for today'],
  },
]

function PassCard({ pass, onClose }) {
  const downloadPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [86, 54] })
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 86, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('SMTS DAILY PASS', 4, 6)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(pass.pass_type_display || pass.pass_type, 4, 11)
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(pass.passenger_name || '', 4, 22)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(`Pass: ${pass.pass_number}`, 4, 28)
    doc.text(`Depot: ${pass.depot_name}`, 4, 33)
    doc.text(`Valid: ${pass.valid_date}`, 4, 38)
    doc.text(`Price: ₹${pass.price}`, 4, 43)
    if (pass.qr_code) {
      try { doc.addImage(`data:image/png;base64,${pass.qr_code}`, 'PNG', 60, 16, 22, 22) } catch {}
    }
    doc.save(`${pass.pass_number}.pdf`)
    toast.success('Pass downloaded!')
  }

  const opt = PASS_OPTIONS.find(o => o.type === pass.pass_type) || PASS_OPTIONS[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Metro card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: opt.gradient,
        borderRadius: 16,
        padding: '24px 24px 20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 20px 60px ${opt.color}40`,
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                SMTS · DAILY PASS
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{opt.label}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
              ACTIVE
            </span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{pass.passenger_name}</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', marginTop: 3, letterSpacing: '0.08em' }}>{pass.pass_number}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>Valid Today</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{pass.valid_date}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{pass.depot_name}</div>
            </div>
            {pass.qr_code && (
              <div style={{ background: 'white', borderRadius: 8, padding: 4 }}>
                <img src={`data:image/png;base64,${pass.qr_code}`} alt="QR" style={{ width: 60, height: 60, display: 'block' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 380 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
          <QrCode size={14} /> View Pass
        </button>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={downloadPDF}>
          <Download size={14} /> Download PDF
        </button>
      </div>
    </div>
  )
}

export default function DailyPass() {
  const [step, setStep] = useState(0)
  const [selectedDepot, setSelectedDepot] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [selectedType, setSelectedType] = useState(null)
  const [generatedPass, setGeneratedPass] = useState(null)

  const { data: depotsData } = useQuery({
    queryKey: ['depots-list'],
    queryFn: () => depotService.list({ page_size: 50 }).then(r => r.data),
  })
  const { data: routesData } = useQuery({
    queryKey: ['routes-list'],
    queryFn: () => routeService.list({ page_size: 100 }).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data) => dailyPassService.create(data),
    onSuccess: (res) => {
      setGeneratedPass(res.data)
      setStep(3)
      toast.success('Daily pass generated!')
    },
    onError: (err) => {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Failed to generate pass.')
    },
  })

  const depots = depotsData?.results || []
  const routes = routesData?.results || []
  const selectedOpt = PASS_OPTIONS.find(o => o.type === selectedType)

  const handlePay = () => {
    mutation.mutate({
      depot: selectedDepot,
      route: selectedRoute || undefined,
      pass_type: selectedType,
      source,
      destination,
    })
  }

  const reset = () => {
    setStep(0)
    setSelectedDepot(null)
    setSelectedRoute(null)
    setSource('')
    setDestination('')
    setSelectedType(null)
    setGeneratedPass(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Pass</h1>
          <p className="page-subtitle">Instant pass — valid for today only · No approval required</p>
        </div>
        {step > 0 && step < 3 && (
          <button className="btn btn-secondary btn-sm" onClick={reset}>Start Over</button>
        )}
      </div>

      {/* Step indicator */}
      {step < 3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, overflowX: 'auto' }}>
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

      {/* ── Step 0: Select Route ── */}
      {step === 0 && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              Travel Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Depot *</label>
                <select className="form-input" value={selectedDepot || ''} onChange={e => setSelectedDepot(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select depot…</option>
                  {depots.map(d => <option key={d.id} value={d.id}>{d.name} — {d.city}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">From (optional)</label>
                  <input className="form-input" placeholder="Source stop" value={source} onChange={e => setSource(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">To (optional)</label>
                  <input className="form-input" placeholder="Destination stop" value={destination} onChange={e => setDestination(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Route (optional)</label>
                <select className="form-input" value={selectedRoute || ''} onChange={e => setSelectedRoute(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Any route</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_number} — {r.source} → {r.destination}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" disabled={!selectedDepot} onClick={() => setStep(1)} style={{ alignSelf: 'flex-start' }}>
                Next: Choose Pass <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Choose Pass Type ── */}
      {step === 1 && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Select pass type for today, {format(new Date(), 'd MMMM yyyy')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ maxWidth: 680, marginBottom: 24 }}>
            {PASS_OPTIONS.map(opt => (
              <div
                key={opt.type}
                onClick={() => setSelectedType(opt.type)}
                style={{
                  borderRadius: 16, padding: 24, cursor: 'pointer',
                  border: `2px solid ${selectedType === opt.type ? opt.color : 'var(--border)'}`,
                  background: selectedType === opt.type ? `${opt.color}08` : 'var(--surface)',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {selectedType === opt.type && (
                  <div style={{ position: 'absolute', top: 14, right: 14 }}>
                    <CheckCircle size={18} style={{ color: opt.color }} />
                  </div>
                )}
                <div style={{
                  width: 48, height: 48, borderRadius: 12, marginBottom: 14,
                  background: opt.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CreditCard size={22} style={{ color: 'white' }} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: opt.color, marginBottom: 8 }}>₹{opt.price}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{opt.description}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {opt.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <CheckCircle size={11} style={{ color: opt.color, flexShrink: 0 }} /> {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" disabled={!selectedType} onClick={() => setStep(2)}>
              Next: Confirm <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Confirm & Pay ── */}
      {step === 2 && selectedOpt && (
        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              Order Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Pass Type', selectedOpt.label],
                ['Depot', depots.find(d => d.id === selectedDepot)?.name || '—'],
                ['Valid Date', format(new Date(), 'd MMMM yyyy')],
                selectedRoute ? ['Route', routes.find(r => r.id === selectedRoute)?.route_number] : null,
                source ? ['From', source] : null,
                destination ? ['To', destination] : null,
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: selectedOpt.color }}>₹{selectedOpt.price}</span>
              </div>
            </div>
          </div>
          <div className="alert-banner info" style={{ marginBottom: 16 }}>
            <Zap size={14} />
            <span>Payment will be processed and your pass generated instantly.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center', background: selectedOpt.gradient, border: 'none' }}
              disabled={mutation.isPending}
              onClick={handlePay}
            >
              {mutation.isPending ? 'Generating…' : `Pay ₹${selectedOpt.price} & Get Pass`}
              {!mutation.isPending && <Zap size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generated Pass ── */}
      {step === 3 && generatedPass && (
        <div>
          <div className="alert-banner success" style={{ marginBottom: 24, maxWidth: 480 }}>
            <CheckCircle size={14} />
            <span>Your daily pass has been generated successfully!</span>
          </div>
          <PassCard pass={generatedPass} onClose={reset} />
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-secondary btn-sm" onClick={reset}>Generate Another Pass</button>
          </div>
        </div>
      )}
    </div>
  )
}
