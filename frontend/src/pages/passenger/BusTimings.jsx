import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Search, Bus, MapPin, ArrowRight, CheckCircle,
  AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Navigation, Ticket, CreditCard, RefreshCw, Timer,
  Calendar, Zap,
} from 'lucide-react'
import { routeService, busTimingsService, tripService } from '@/services/services'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// ── Status helpers ────────────────────────────────────────────────────────────
function StatusBadge({ status, delayMinutes }) {
  const map = {
    ON_TIME: { label: 'On Time', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)', icon: CheckCircle },
    SCHEDULED: { label: 'On Time', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)', icon: CheckCircle },
    DELAYED: { label: `Delayed ${delayMinutes}m`, color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
    CANCELLED: { label: 'Cancelled', color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)', icon: XCircle },
    IN_PROGRESS: { label: 'In Transit', color: 'var(--primary)', bg: 'var(--primary-light)', icon: Navigation },
    COMPLETED: { label: 'Completed', color: 'var(--text-muted)', bg: 'var(--surface-2)', icon: CheckCircle },
  }
  const cfg = map[status] || map['SCHEDULED']
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, color: cfg.color,
      background: cfg.bg, padding: '3px 8px', borderRadius: 20,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

// ── Stop Timeline ─────────────────────────────────────────────────────────────
function StopTimeline({ stops, boardingStopId, onSelectStop }) {
  return (
    <div style={{ padding: '4px 0' }}>
      {stops.map((stop, i) => {
        const isFirst = i === 0
        const isLast = i === stops.length - 1
        const isBoarding = String(stop.stop_id) === String(boardingStopId)
        return (
          <div key={stop.stop_id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* Timeline column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: isBoarding ? 'var(--primary)' : isFirst || isLast ? 'var(--primary)' : 'var(--border-strong)',
                border: isBoarding ? '2px solid var(--primary)' : '2px solid transparent',
                boxShadow: isBoarding ? '0 0 0 3px var(--primary-light)' : 'none',
                transition: 'all 0.2s',
              }} />
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--border)', marginTop: 2 }} />
              )}
            </div>
            {/* Stop info */}
            <button
              onClick={() => onSelectStop && onSelectStop(stop)}
              style={{
                flex: 1, paddingBottom: isLast ? 0 : 16, textAlign: 'left',
                background: 'none', border: 'none', cursor: onSelectStop ? 'pointer' : 'default',
                padding: '0 8px 16px 0',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: isBoarding ? 'var(--primary-light)' : 'transparent',
                transition: 'background 0.15s',
              }}>
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: isBoarding || isFirst || isLast ? 700 : 500,
                    color: isBoarding ? 'var(--primary)' : 'var(--text-primary)',
                  }}>
                    {stop.stop_name}
                  </div>
                  {stop.travel_minutes_from_prev > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      +{stop.travel_minutes_from_prev} min from prev
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: isBoarding ? 'var(--primary)' : 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                }}>
                  {stop.estimated_time}
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── ETA Card ──────────────────────────────────────────────────────────────────
function ETACard({ eta, boardingStop, trip, onClear }) {
  if (!eta) return null
  const isDelayed = eta.is_delayed
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        borderRadius: 'var(--radius)',
        border: `1px solid ${isDelayed ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
        background: isDelayed ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.05)',
        padding: '16px 18px',
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Bus Expected At Your Stop
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            <MapPin size={10} style={{ marginRight: 3 }} />{boardingStop?.stop_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {eta.estimated_time}
            </span>
            {eta.remaining_minutes != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {eta.remaining_minutes <= 0 ? 'Now' : `in ${eta.remaining_minutes} min`}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <StatusBadge status={isDelayed ? 'DELAYED' : 'ON_TIME'} delayMinutes={eta.delay_minutes} />
          {isDelayed && eta.delay_reason && (
            <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6, maxWidth: 140, textAlign: 'right' }}>
              Reason: {eta.delay_reason}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClear}
        style={{
          marginTop: 10, fontSize: 11, color: 'var(--text-muted)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', padding: 0,
        }}
      >
        ✕ Clear boarding stop
      </button>
    </motion.div>
  )
}

// ── Frequency slots ───────────────────────────────────────────────────────────
function FrequencyBadges({ slots, selectedSlot, onSelect }) {
  if (!slots || slots.length <= 1) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
        Today's Departures
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {slots.map(slot => (
          <button
            key={slot}
            onClick={() => onSelect(slot)}
            style={{
              padding: '4px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              background: selectedSlot === slot ? 'var(--primary)' : 'var(--surface-2)',
              color: selectedSlot === slot ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${selectedSlot === slot ? 'var(--primary)' : 'var(--border)'}`,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Trip / Schedule Card ──────────────────────────────────────────────────────
function TripCard({ trip, route }) {
  const [expanded, setExpanded] = useState(false)
  const [boardingStop, setBoardingStop] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const navigate = useNavigate()

  const { data: etaData } = useQuery({
    queryKey: ['eta', route?.id, trip.id, boardingStop?.stop_id],
    queryFn: () => routeService.eta(route.id, trip.id, boardingStop.stop_id).then(r => r.data),
    enabled: !!(route?.id && trip.id && boardingStop?.stop_id),
  })

  const stops = trip.stop_timeline || []

  const stats = [
    { label: 'Departure', value: selectedSlot || trip.departure_display || trip.departure_time || '—', mono: true },
    { label: 'Arrival', value: trip.arrival_display || trip.arrival_time || '—', mono: true },
    { label: 'Journey', value: stops.length > 0 ? `${stops[stops.length - 1]?.cumulative_minutes} min` : '—' },
    { label: 'Fare', value: trip.fare ? `₹${trip.fare}` : '—' },
    { label: 'Stops', value: trip.stop_count || stops.length || '—' },
    { label: 'Seats', value: trip.available_seats ?? '—' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{ padding: '18px 20px', marginBottom: 12 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius)',
            background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bus size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {trip.bus_number}
              </span>
              <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {trip.route_number} · {trip.source} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} /> {trip.destination}
            </div>
          </div>
        </div>
        {/* Departure time big display */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Departure</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
          }}>
            {selectedSlot || trip.departure_display || trip.departure_time || '—'}
          </div>
          {trip.delay_minutes > 0 && (
            <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
              +{trip.delay_minutes}m delay
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        gap: 12, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        marginBottom: 14,
      }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 3 }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              fontVariantNumeric: s.mono ? 'tabular-nums' : 'normal',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Frequency */}
      <FrequencyBadges
        slots={trip.departure_slots}
        selectedSlot={selectedSlot}
        onSelect={setSelectedSlot}
      />

      {/* ETA result */}
      <AnimatePresence>
        {boardingStop && (
          <ETACard
            eta={etaData?.eta}
            boardingStop={boardingStop}
            trip={trip}
            onClear={() => setBoardingStop(null)}
          />
        )}
      </AnimatePresence>

      {/* Stops timeline */}
      <AnimatePresence>
        {expanded && stops.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginTop: 14 }}
          >
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <MapPin size={11} /> Route Stops
              {boardingStop && (
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  — tap a stop for ETA
                </span>
              )}
            </div>
            {!boardingStop && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Tap a stop below to calculate your ETA
              </p>
            )}
            <StopTimeline
              stops={stops}
              boardingStopId={boardingStop?.stop_id}
              onSelectStop={(stop) => setBoardingStop(stop)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {stops.length > 0 && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide Stops' : 'View Stops'}
          </button>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/tickets', { state: { routeNumber: trip.route_number, tripId: trip.id } })}
        >
          <Ticket size={13} /> Book Ticket
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/passes/apply')}
        >
          <CreditCard size={13} /> Apply Pass
        </button>
      </div>
    </motion.div>
  )
}

// ── Journey Planner ───────────────────────────────────────────────────────────
function JourneyPlanner() {
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [query, setQuery] = useState(null)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['journey-planner', query?.source, query?.destination],
    queryFn: () => routeService.journeyPlanner(query.source, query.destination).then(r => r.data),
    enabled: !!(query?.source && query?.destination),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    if (!source.trim() || !destination.trim()) return toast.error('Enter both source and destination.')
    setQuery({ source: source.trim(), destination: destination.trim() })
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
          <label className="form-label">From</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Source stop or city" value={source} onChange={e => setSource(e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
          <label className="form-label">To</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--danger)', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 30 }} placeholder="Destination stop or city" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          <Search size={13} /> Plan Journey
        </button>
      </form>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
          Finding routes…
        </div>
      )}

      {data && (
        data.results.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <Bus size={28} style={{ color: 'var(--text-subtle)', marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No direct routes found</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Try searching from the Route Search tab</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.results.map(route => (
              <div key={route.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--primary)',
                        background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 6,
                      }}>
                        Route {route.route_number}
                      </span>
                      {route.next_trip_status && (
                        <StatusBadge status={route.next_trip_status} delayMinutes={route.next_trip_delay || 0} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {route.source} → {route.destination}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        { l: 'Journey', v: route.total_journey_minutes ? `${route.total_journey_minutes} min` : '—' },
                        { l: 'Fare', v: route.fare ? `₹${route.fare}` : '—' },
                        { l: 'Stops', v: route.stop_count || '—' },
                        { l: 'Next Bus', v: route.next_departure || '—', mono: true },
                      ].map(({ l, v, mono }) => (
                        <div key={l}>
                          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/tickets', { state: { routeNumber: route.route_number } })}>
                    <Ticket size={12} /> Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BusTimings() {
  const [activeTab, setActiveTab] = useState('route') // 'route' | 'journey'
  const [routeSearch, setRouteSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Route search results
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['route-search', searchQuery],
    queryFn: () => routeService.search(searchQuery).then(r => r.data),
    enabled: searchQuery.length >= 1,
  })

  // Full today's schedule (no search)
  const { data: timingsData, isLoading: timingsLoading, refetch } = useQuery({
    queryKey: ['bus-timings'],
    queryFn: () => busTimingsService.list().then(r => r.data),
    refetchInterval: 60000, // refresh every minute
  })

  // If user searched → fetch schedule for each found route
  const [selectedRoute, setSelectedRoute] = useState(null)

  const { data: routeSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['route-schedule', selectedRoute?.id],
    queryFn: () => routeService.schedule(selectedRoute.id).then(r => r.data),
    enabled: !!selectedRoute?.id,
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchQuery(routeSearch.trim())
    setSelectedRoute(null)
  }

  const tabs = [
    { key: 'route', label: 'Route Search', icon: Search },
    { key: 'journey', label: 'Journey Planner', icon: Navigation },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Bus Timings & ETA</h1>
          <p className="page-subtitle">
            Search routes, view schedules, and calculate your stop ETA
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
              color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${activeTab === key ? 'var(--primary)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Route Search Tab ── */}
      {activeTab === 'route' && (
        <div>
          {/* Search form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label">Route Number, Source, or Destination</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 30 }}
                  placeholder="e.g. 139, Swargate, Katraj…"
                  value={routeSearch}
                  onChange={e => setRouteSearch(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              <Search size={13} /> Search
            </button>
            {searchQuery && (
              <button type="button" className="btn btn-secondary" onClick={() => { setRouteSearch(''); setSearchQuery(''); setSelectedRoute(null) }}>
                Clear
              </button>
            )}
          </form>

          {/* Search results: route list */}
          {searchQuery && !selectedRoute && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                {searchLoading ? 'Searching…' : `${searchData?.count || 0} routes found for "${searchQuery}"`}
              </div>
              {!searchLoading && searchData?.results?.map(route => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', marginBottom: 8, padding: '12px 16px',
                    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                    background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: 6 }}>
                        {route.route_number}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{route.route_name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={10} style={{ color: 'var(--primary)' }} />
                      {route.source}
                      <ArrowRight size={10} />
                      <MapPin size={10} style={{ color: 'var(--danger)' }} />
                      {route.destination}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>₹{route.fare}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{route.stop_count} stops · {route.total_journey_minutes} min</div>
                  </div>
                </button>
              ))}
              {!searchLoading && searchData?.count === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                  <Bus size={24} style={{ color: 'var(--text-subtle)', marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No routes found</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Try a different route number or stop name</div>
                </div>
              )}
            </div>
          )}

          {/* Selected route: schedule */}
          {selectedRoute && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setSelectedRoute(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'inherit', padding: 0 }}
                >
                  ← Back to results
                </button>
                <span style={{ color: 'var(--text-subtle)' }}>·</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: 'var(--primary)',
                  background: 'var(--primary-light)', padding: '2px 10px', borderRadius: 8,
                }}>
                  Route {selectedRoute.route_number}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedRoute.source} → {selectedRoute.destination}
                </span>
              </div>

              {scheduleLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)}
                </div>
              ) : routeSchedule?.trips?.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <Calendar size={28} style={{ color: 'var(--text-subtle)', marginBottom: 10 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No trips scheduled today</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Check back later or contact your depot</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {routeSchedule?.total_trips} trip{routeSchedule?.total_trips !== 1 ? 's' : ''} scheduled · Tap "View Stops" then tap a stop to calculate ETA
                  </div>
                  {routeSchedule?.trips?.map(trip => (
                    <TripCard key={trip.id} trip={trip} route={selectedRoute} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Default: today's full schedule */}
          {!searchQuery && !selectedRoute && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {timingsLoading ? 'Loading…' : `${timingsData?.length || 0} buses scheduled today`}
                <span style={{ color: 'var(--text-subtle)', marginLeft: 8, fontSize: 11 }}>
                  Auto-refreshes every minute
                </span>
              </div>

              {timingsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => <div key={i} className="card skeleton" style={{ height: 160 }} />)}
                </div>
              ) : timingsData?.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <Bus size={40} style={{ color: 'var(--text-subtle)', marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    No buses scheduled yet
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Schedules are managed by your depot admin.
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/routes')}>
                      Browse Routes
                    </button>
                  </div>
                </div>
              ) : (
                timingsData.map(trip => (
                  <div key={trip.trip_id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Bus size={14} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{trip.bus_number}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 7px', borderRadius: 5 }}>
                            {trip.route_number}
                          </span>
                          <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {trip.source} → {trip.destination}
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {[
                            { l: 'Departure', v: trip.departure_time, mono: true },
                            { l: 'Arrival', v: trip.arrival_time || '—', mono: true },
                            { l: 'Journey', v: trip.total_journey_minutes ? `${trip.total_journey_minutes} min` : '—' },
                            { l: 'Fare', v: `₹${trip.fare}` },
                            { l: 'Seats', v: trip.available_seats },
                          ].map(({ l, v, mono }) => (
                            <div key={l}>
                              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 2 }}>{l}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Book button removed as requested */}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Journey Planner Tab ── */}
      {activeTab === 'journey' && <JourneyPlanner />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
