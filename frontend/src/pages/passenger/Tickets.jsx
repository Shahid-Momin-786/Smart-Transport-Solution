import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketService, tripService } from '@/services/services'
import {
  Ticket, Download, X, QrCode, Search, MapPin,
  Bus, Calendar, ArrowRight, Loader2, Users,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { useAuth } from '@/contexts/AuthContext'

const STATUS_CONFIG = {
  CONFIRMED: { label: 'Confirmed', badge: 'badge-primary', headerBg: 'var(--primary)', headerBgDark: '#1e40af' },
  USED:      { label: 'Used',      badge: 'badge-success', headerBg: 'var(--success)', headerBgDark: '#14532d' },
  CANCELLED: { label: 'Cancelled', badge: 'badge-danger',  headerBg: 'var(--danger)',  headerBgDark: '#7f1d1d' },
  EXPIRED:   { label: 'Expired',   badge: 'badge-secondary', headerBg: 'var(--text-muted)', headerBgDark: '#374151' },
}

function DigitalTicketCard({ ticket, onView, onCancel, cancelling }) {
  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.EXPIRED

  return (
    <div className="ticket-digital">
      {/* Header strip */}
      <div className="ticket-digital-header" style={{ background: cfg.headerBg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Smart Transport Solution
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'white', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {ticket.ticket_number}
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'white',
            background: 'rgba(255,255,255,0.2)', borderRadius: 3,
            padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Dashed divider */}
      <div className="ticket-divider-dashed">
        <div className="ticket-divider-line" />
      </div>

      {/* Body */}
      <div className="ticket-digital-body">
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Main info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Route */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{ticket.source}</span>
              <ArrowRight size={11} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ticket.destination}
              </span>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {[
                { icon: Bus, label: 'Bus', val: ticket.bus_number || '—' },
                { icon: Users, label: 'Seat', val: ticket.seat_number || '—' },
                { icon: Calendar, label: 'Date', val: ticket.trip_start_time ? format(new Date(ticket.trip_start_time), 'd MMM yyyy') : '—' },
                { icon: MapPin, label: 'Route', val: ticket.route_number },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {/* Fare + actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fare</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>₹{ticket.fare}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => onView(ticket)}>
                  <QrCode size={12} /> View
                </button>
                {ticket.status === 'CONFIRMED' && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onCancel(ticket)}
                    disabled={cancelling}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* QR Code */}
          {ticket.qr_code && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <img
                src={`data:image/png;base64,${ticket.qr_code}`}
                alt="QR Code"
                style={{ width: 72, height: 72, borderRadius: 4, border: '1px solid var(--border)' }}
              />
              <span style={{ fontSize: 9, color: 'var(--text-subtle)', textAlign: 'center' }}>Scan to board</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TicketDetailModal({ ticket, onClose }) {
  const downloadPDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 150] })
    const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.EXPIRED

    // Simple header
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 100, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Smart Transport Solution', 8, 10)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Official Travel Ticket', 8, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`#${ticket.ticket_number}`, 8, 24)

    doc.setTextColor(15, 23, 42)
    const fields = [
      ['Passenger', ticket.passenger_name],
      ['Route', `${ticket.route_number} · ${ticket.route_name}`],
      ['From', ticket.source],
      ['To', ticket.destination],
      ['Bus', ticket.bus_number],
      ['Seat', ticket.seat_number],
      ['Date', ticket.trip_start_time ? format(new Date(ticket.trip_start_time), 'dd MMM yyyy HH:mm') : '—'],
      ['Fare', `Rs. ${ticket.fare}`],
      ['Status', ticket.status],
    ]

    let y = 36
    fields.forEach(([label, value]) => {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.text(label, 8, y)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(String(value || '—'), 35, y)
      y += 8
    })

    if (ticket.qr_code) {
      try { doc.addImage(`data:image/png;base64,${ticket.qr_code}`, 'PNG', 65, 36, 28, 28) } catch {}
    }

    doc.setDrawColor(229, 231, 235)
    doc.setLineDashPattern([2, 2], 0)
    doc.line(0, 120, 100, 120)
    doc.setTextColor(107, 114, 128)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text('This is a computer-generated ticket. Keep it safe.', 8, 127)
    doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 8, 132)
    doc.save(`${ticket.ticket_number}.pdf`)
    toast.success('PDF downloaded!')
  }

  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.EXPIRED

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Ticket Details</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body">
          {/* Full ticket card */}
          <div className="ticket-card">
            <div className="ticket-header" style={{ background: cfg.headerBg }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Smart Transport Solution
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  {ticket.ticket_number}
                </div>
              </div>
              <span className={`badge ${cfg.badge}`} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
                {cfg.label}
              </span>
            </div>
            <div className="ticket-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Passenger', ticket.passenger_name],
                  ['Route', `${ticket.route_number} · ${ticket.route_name}`],
                  ['From → To', `${ticket.source} → ${ticket.destination}`],
                  ['Bus', ticket.bus_number],
                  ['Seat', ticket.seat_number],
                  ['Date', ticket.trip_start_time ? format(new Date(ticket.trip_start_time), 'dd MMM yyyy, HH:mm') : '—'],
                  ['Fare', `₹${ticket.fare}`],
                  ['Depot', ticket.depot_name],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: label === 'Fare' ? 700 : 500, color: 'var(--text-primary)' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
              {ticket.qr_code && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingLeft: 8, borderLeft: '1px solid var(--border)' }}>
                  <img src={`data:image/png;base64,${ticket.qr_code}`} alt="QR Code" style={{ width: 100, height: 100 }} />
                  <span style={{ fontSize: 9, color: 'var(--text-subtle)', textAlign: 'center' }}>Scan to verify</span>
                </div>
              )}
            </div>
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

function BookingModal({ onClose, onBooked }) {
  const [tripId, setTripId] = useState('')
  const [seat, setSeat] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: tripsData } = useQuery({
    queryKey: ['trips-available'],
    queryFn: () => tripService.list({ status: 'SCHEDULED', page_size: 20 }).then(r => r.data),
  })

  const handleBook = async () => {
    if (!tripId || !seat) return toast.error('Select a trip and enter a seat number.')
    setLoading(true)
    try {
      await ticketService.book({ trip: tripId, seat_number: seat })
      toast.success('Ticket booked successfully!')
      onBooked()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const trips = tripsData?.results || []
  const selectedTrip = trips.find(t => String(t.id) === String(tripId))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Book a Ticket</h3>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Select Trip *</label>
            <select className="form-input" value={tripId} onChange={e => setTripId(e.target.value)}>
              <option value="">Choose a trip…</option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>
                  {t.route_number} · {t.bus_number} · {t.available_seats} seats left
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Seat Number *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. A1, B3"
              value={seat}
              onChange={e => setSeat(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <p className="form-help">Format: Letter + Number (A1 to E10)</p>
          </div>
          {selectedTrip && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>Fare</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{selectedTrip.route?.fare || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>Available</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>{selectedTrip.available_seats} seats</div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleBook} disabled={loading || !tripId || !seat}>
            {loading ? <><Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> Booking…</> : 'Confirm Booking'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'USED', label: 'Used' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

export default function PassengerTickets() {
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [cancellingId, setCancellingId] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets', search, statusFilter, page],
    queryFn: () => ticketService.myTickets({ search, status: statusFilter || undefined, page, page_size: 12 }).then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => ticketService.cancel(id),
    onSuccess: () => {
      toast.success('Ticket cancelled.')
      queryClient.invalidateQueries(['my-tickets'])
      setCancellingId(null)
    },
    onError: () => {
      toast.error('Failed to cancel ticket.')
      setCancellingId(null)
    },
  })

  const handleCancel = (ticket) => {
    if (confirm(`Cancel ticket ${ticket.ticket_number}? This cannot be undone.`)) {
      setCancellingId(ticket.id)
      cancelMutation.mutate(ticket.id)
    }
  }

  const tickets = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">{data?.count || 0} tickets total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setBookingOpen(true)}>
          + Book Ticket
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Filter tabs */}
        <div className="filter-tabs">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`filter-tab ${statusFilter === key ? 'active' : ''}`}
              onClick={() => { setStatusFilter(key); setPage(1) }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="search-input-wrapper" style={{ marginLeft: 'auto' }}>
          <Search className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            style={{ width: 220 }}
            placeholder="Search tickets…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Ticket grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="ticket-digital">
              <div style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 60, borderRadius: 6, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 80, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Ticket size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No tickets found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {search || statusFilter ? 'Try different filters' : 'Book your first journey'}
            </div>
            {!search && !statusFilter && (
              <button className="btn btn-primary btn-sm" onClick={() => setBookingOpen(true)}>
                Book a Ticket
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map(t => (
            <DigitalTicketCard
              key={t.id}
              ticket={t}
              onView={setSelectedTicket}
              onCancel={handleCancel}
              cancelling={cancellingId === t.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 8px' }}>{page} / {data.total_pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {selectedTicket && <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      {bookingOpen && (
        <BookingModal
          onClose={() => setBookingOpen(false)}
          onBooked={() => { queryClient.invalidateQueries(['my-tickets']); setBookingOpen(false) }}
        />
      )}
    </div>
  )
}
