import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { routeService, tripService, ticketService } from '@/services/services'
import {
  Search, MapPin, Clock, ArrowRight, Bus, Users,
  ChevronDown, ChevronUp, X, CheckCircle, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function BookingModal({ route, onClose, onBooked }) {
  const [tripId, setTripId] = useState('')
  const [seat, setSeat] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: tripsData } = useQuery({
    queryKey: ['trips-for-route', route?.id],
    queryFn: () => tripService.list({ status: 'SCHEDULED', page_size: 20 }).then(r => r.data),
    enabled: !!route,
  })

  const trips = (tripsData?.results || []).filter(t =>
    !route || t.route_number === route.route_number
  )
  const allTrips = tripsData?.results || []
  const displayTrips = route ? trips.length > 0 ? trips : allTrips : allTrips

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

  const selectedTrip = displayTrips.find(t => String(t.id) === String(tripId))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Book Ticket
            </h3>
            {route && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {route.route_number} · {route.source} → {route.destination}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trip selection */}
          <div className="form-group">
            <label className="form-label">Select Trip *</label>
            <select className="form-input" value={tripId} onChange={e => setTripId(e.target.value)}>
              <option value="">Choose an available trip…</option>
              {displayTrips.map(t => (
                <option key={t.id} value={t.id}>
                  {t.route_number} · {t.bus_number} · {t.available_seats} seats left
                  {t.departure_time ? ` · ${format(new Date(t.departure_time), 'HH:mm, d MMM')}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Seat number */}
          <div className="form-group">
            <label className="form-label">Seat Number *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. A1, B3, C5"
              value={seat}
              onChange={e => setSeat(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <p className="form-help">Format: Letter + Number (A1 to E10)</p>
          </div>

          {/* Fare summary */}
          {selectedTrip && (
            <div style={{
              padding: '12px 14px', background: 'var(--surface)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Route Fare</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  ₹{route?.fare || selectedTrip?.route?.fare || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Seats Available</div>
                <div style={{
                  fontSize: 15, fontWeight: 600,
                  color: selectedTrip.available_seats > 5 ? 'var(--success)' : 'var(--warning)',
                }}>
                  {selectedTrip.available_seats} left
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBook}
            disabled={loading || !tripId || !seat}
          >
            {loading ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Booking…</> : 'Confirm Booking'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function RouteCard({ route, onBook }) {
  const [expanded, setExpanded] = useState(false)

  const { data: stopsData } = useQuery({
    queryKey: ['route-stops', route.id],
    queryFn: () => routeService.stops(route.id).then(r => r.data),
    enabled: expanded,
  })

  const seatsIndicator = route.is_active
    ? { label: 'Available', color: 'var(--success)', bg: 'var(--success-light)' }
    : { label: 'Inactive', color: 'var(--text-muted)', bg: 'var(--surface-2)' }

  return (
    <div className="route-card">
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius)',
          background: 'var(--primary-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>
            {route.route_number?.split('-')[1] || route.route_number?.slice(-3)}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{route.route_number}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {route.route_name}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, color: seatsIndicator.color,
              background: seatsIndicator.bg, padding: '1px 6px', borderRadius: 3, flexShrink: 0,
            }}>
              {seatsIndicator.label}
            </span>
          </div>

          {/* Source → Destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{route.source}</span>
            </div>
            <ArrowRight size={11} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{route.destination}</span>
            </div>
          </div>

          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fare</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>₹{route.fare}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{route.distance} km</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stops</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{route.stop_count}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setExpanded(e => !e)}
                style={{ fontSize: 11 }}
              >
                Stops {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {route.is_active && (
                <button className="btn btn-primary btn-sm" onClick={() => onBook(route)}>
                  Book Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded stops */}
      {expanded && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Route Stops
          </div>
          {stopsData ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              {stopsData.map((stop, i) => (
                <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 || i === stopsData.length - 1 ? 'var(--primary)' : 'var(--border-strong)',
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{stop.name}</span>
                  {i < stopsData.length - 1 && (
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 2px' }}>→</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 16, width: '80%', borderRadius: 4 }} />
          )}
        </div>
      )}
    </div>
  )
}

export default function PassengerRoutes() {
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [bookingRoute, setBookingRoute] = useState(null)
  const queryClient = useQueryClient()

  const effectiveSearch = source || destination || search

  const { data, isLoading } = useQuery({
    queryKey: ['routes', effectiveSearch, page],
    queryFn: () => routeService.list({ search: effectiveSearch, page, page_size: 10 }).then(r => r.data),
  })

  const routes = data?.results || []

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
  }

  const handleBooked = () => {
    queryClient.invalidateQueries(['my-tickets'])
    setBookingRoute(null)
    toast.success('Journey booked! Check My Tickets.')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Find a Route</h1>
          <p className="page-subtitle">Search routes, view schedules, and book your journey</p>
        </div>
      </div>

      {/* ── Search Panel ── */}
      <form onSubmit={handleSearch} className="route-search-panel" style={{ marginBottom: 20 }}>
        <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
          <label className="form-label">From</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--primary)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Source city or stop"
              value={source}
              onChange={e => setSource(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
          <label className="form-label">To</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--danger)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Destination city or stop"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label">Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-subtle)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 30 }}
              placeholder="Route number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">
            <Search size={13} /> Search
          </button>
          {(source || destination || search) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setSource(''); setDestination(''); setSearch(''); setPage(1) }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </form>

      {/* ── Results header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isLoading ? 'Searching…' : `${data?.count || 0} routes found`}
        </div>
      </div>

      {/* ── Route Cards ── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="route-card">
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '30%', height: 14, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '60%', height: 12, marginBottom: 12 }} />
                  <div className="skeleton" style={{ width: '80%', height: 12 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : routes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Bus size={32} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No routes found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Try different source or destination</div>
            {(source || destination || search) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setSource(''); setDestination(''); setSearch(''); setPage(1) }}
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {routes.map(route => (
            <RouteCard key={route.id} route={route} onBook={setBookingRoute} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 8px' }}>
            {page} / {data.total_pages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}

      {bookingRoute && (
        <BookingModal
          route={bookingRoute}
          onClose={() => setBookingRoute(null)}
          onBooked={handleBooked}
        />
      )}
    </div>
  )
}
