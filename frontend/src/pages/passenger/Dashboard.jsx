import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ticketService, passService, notificationService, routeService, passApplicationService, generatedPassService, busTimingsService } from '@/services/services'
import {
  Ticket, CreditCard, Clock, Route, ArrowRight,
  Bus, Zap, QrCode, ChevronRight, TrendingUp,
  CheckCircle, XCircle, Calendar, FileText, AlertCircle, Navigation,
} from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const STATUS_CONFIG = {
  CONFIRMED: { label: 'Confirmed', color: 'var(--primary)', bg: 'var(--primary-light)', icon: CheckCircle },
  USED: { label: 'Used', color: 'var(--success)', bg: 'var(--success-light)', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'var(--danger)', bg: 'var(--danger-light)', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'var(--text-muted)', bg: 'var(--surface-2)', icon: Clock },
}

const QUICK_ACTIONS = [
  { label: 'Book Ticket', icon: Ticket, to: '/routes', color: 'var(--primary)' },
  { label: 'Daily Pass', icon: Zap, to: '/passes/daily', color: '#7c3aed' },
  { label: 'Apply Pass', icon: FileText, to: '/passes/apply', color: 'var(--success)' },
  { label: 'Bus Timings', icon: Clock, to: '/bus-timings', color: 'var(--warning)' },
]

export default function PassengerDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]

  const { data: ticketsData } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => ticketService.myTickets({ page_size: 100 }).then(r => r.data),
  })

  const { data: passesData } = useQuery({
    queryKey: ['my-passes'],
    queryFn: () => passService.myPasses({ page_size: 100 }).then(r => r.data),
  })

  const { data: generatedPassesData } = useQuery({
    queryKey: ['my-generated-passes'],
    queryFn: () => generatedPassService.myList({ page_size: 10 }).then(r => r.data),
  })

  const { data: applicationsData } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => passApplicationService.myList({ page_size: 50 }).then(r => r.data),
  })

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationService.unreadCount().then(r => r.data),
  })

  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routeService.list({ page_size: 4 }).then(r => r.data),
  })

  const tickets = ticketsData?.results || []
  const passes = passesData?.results || []
  const generatedPasses = generatedPassesData?.results || []
  const applications = applicationsData?.results || []

  // Find best active pass (generated first, then legacy)
  const activeGeneratedPass = generatedPasses.find(p => p.is_valid)
  const activeLegacyPass = passes.find(p => p.is_valid)
  const activePass = activeGeneratedPass || activeLegacyPass

  const pendingApplications = applications.filter(a => ['PENDING', 'UNDER_VERIFICATION'].includes(a.status))
  const reuploadRequired = applications.filter(a => a.status === 'REUPLOAD_REQUESTED')

  // Expiry warning — active pass expiring in <= 7 days
  const expiringPass = activePass && activePass.is_valid
    ? differenceInDays(new Date(activePass.valid_to), new Date()) <= 7 ? activePass : null
    : null

  const confirmedTickets = tickets.filter(t => t.status === 'CONFIRMED')
  const upcomingTrip = confirmedTickets[0] || null
  const recentActivity = tickets.slice(0, 5)

  const PASS_COLORS = {
    WEEKLY: '#2563eb', MONTHLY: '#16a34a', STUDENT: '#0891b2',
    STUDENT_CAT: '#0891b2', WORKER: '#7c3aed', SENIOR_CITIZEN: '#d97706',
    GENERAL: '#16a34a', DISABLED: '#dc2626',
  }
  const passColor = activePass
    ? (PASS_COLORS[activePass.category] || PASS_COLORS[activePass.pass_type] || '#2563eb')
    : '#2563eb'

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{getGreeting()}, {firstName} 👋</h1>
          <p className="page-subtitle">
            {user?.depot?.name ? `${user.depot.name} · ` : ''}{format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <Link to="/routes" className="btn btn-primary">
          Book a Journey <ArrowRight size={14} />
        </Link>
      </div>

      {/* ── Alerts ── */}
      {expiringPass && (
        <div className="alert-banner warning" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} />
          <span>
            Your pass <strong>{expiringPass.pass_number}</strong> expires in{' '}
            <strong>{differenceInDays(new Date(expiringPass.valid_to), new Date())} days</strong>.
            {' '}<Link to="/passes/apply" style={{ color: 'var(--warning)', fontWeight: 600 }}>Renew now</Link>
          </span>
        </div>
      )}
      {reuploadRequired.length > 0 && (
        <div className="alert-banner danger" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} />
          <span>
            {reuploadRequired.length} application{reuploadRequired.length > 1 ? 's' : ''} require{reuploadRequired.length === 1 ? 's' : ''} document re-upload.{' '}
            <Link to="/passes/applications" style={{ color: 'var(--danger)', fontWeight: 600 }}>View now</Link>
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Row 1: Journey + Active Pass + Next Bus ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming Journey Card */}
          <div className="lg:col-span-2">
            {upcomingTrip ? (
              <div className="journey-card">
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                        Upcoming Journey
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
                        {upcomingTrip.route_number}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', background: 'rgba(255,255,255,0.15)',
                      borderRadius: 4, fontSize: 10, fontWeight: 700,
                      color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}>
                      CONFIRMED
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{upcomingTrip.source}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>From</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
                      <Bus size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{upcomingTrip.destination}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>To</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Bus', val: upcomingTrip.bus_number || '—' },
                      { label: 'Seat', val: upcomingTrip.seat_number || '—' },
                      { label: 'Fare', val: `₹${upcomingTrip.fare}` },
                      { label: 'Date', val: upcomingTrip.trip_start_time ? format(new Date(upcomingTrip.trip_start_time), 'd MMM') : '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{val}</div>
                      </div>
                    ))}
                    <div style={{ marginLeft: 'auto' }}>
                      <Link to="/tickets" className="btn btn-sm" style={{
                        background: 'rgba(255,255,255,0.15)', color: 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: 11,
                      }}>
                        View Ticket <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="journey-card" style={{ minHeight: 140 }}>
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    No Upcoming Journey
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
                    Ready to travel? Book your next trip.
                  </p>
                  <Link to="/routes" className="btn btn-sm" style={{
                    background: 'rgba(255,255,255,0.15)', color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}>
                    Find Routes <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Active Pass Card */}
          <div>
            {activePass ? (
              <div
                className="pass-metro"
                style={{ background: `linear-gradient(135deg, ${passColor}dd, ${passColor})`, cursor: 'pointer', height: '100%', minHeight: 160 }}
                onClick={() => {}}
              >
                <div className="pass-metro-pattern" />
                <div className="pass-metro-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                        {activePass.category_display || activePass.pass_type || 'GENERAL'} PASS
                      </div>
                      <div className="pass-metro-chip" style={{ width: 32, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.3)', marginTop: 8 }} />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: 'white',
                      background: 'rgba(255,255,255,0.2)', borderRadius: 4,
                      padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>ACTIVE</span>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'white', textTransform: 'uppercase' }}>
                      {activePass.passenger_name || user?.name || 'Passenger'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontFamily: 'monospace' }}>
                      {activePass.pass_number || 'N/A'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      Valid until {activePass.valid_to ? format(new Date(activePass.valid_to), 'd MMM yyyy') : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ height: '100%', minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10, textAlign: 'center', padding: 20 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CreditCard size={18} style={{ color: 'var(--text-subtle)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Active Pass</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Get a daily or long-term pass</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link to="/passes/daily" className="btn btn-primary btn-sm"><Zap size={11} /> Daily</Link>
                  <Link to="/passes/apply" className="btn btn-secondary btn-sm">Apply</Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Quick Actions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(({ label, icon: Icon, to, color }) => (
              <Link key={label} to={to} className="quick-action-btn">
                <div className="quick-action-icon">
                  <Icon size={16} style={{ color }} />
                </div>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Pending Applications row ── */}
        {pendingApplications.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Pending Applications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingApplications.slice(0, 3).map(app => (
                <Link
                  key={app.id}
                  to="/passes/applications"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'var(--surface)',
                    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={16} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{app.application_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{app.category_display} · {app.duration_display}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 6,
                    background: app.status === 'UNDER_VERIFICATION' ? '#ede9fe' : '#fef3c7',
                    color: app.status === 'UNDER_VERIFICATION' ? '#7c3aed' : '#d97706',
                  }}>
                    {app.status === 'UNDER_VERIFICATION' ? 'Under Review' : 'Pending'}
                  </span>
                </Link>
              ))}
              {pendingApplications.length > 3 && (
                <Link to="/passes/applications" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, padding: '0 4px' }}>
                  View all {pendingApplications.length} applications →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Row 3: Recent Activity + Route Suggestions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Activity Timeline */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent Activity</span>
                <Link to="/tickets" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
                  View all
                </Link>
              </div>
              <div style={{ padding: '0 16px' }}>
                {recentActivity.length > 0 ? (
                  <div className="timeline">
                    {recentActivity.map(t => {
                      const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.EXPIRED
                      const StatusIcon = cfg.icon
                      return (
                        <div key={t.id} className="timeline-item">
                          <div className="timeline-dot" style={{ background: cfg.bg }}>
                            <StatusIcon size={14} style={{ color: cfg.color }} />
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-title">
                              {t.route_number} — {t.source} → {t.destination}
                            </div>
                            <div className="timeline-subtitle">
                              {t.ticket_number} · Seat {t.seat_number || '—'} ·{' '}
                              <span style={{ color: cfg.color, fontWeight: 500 }}>{t.status}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>₹{t.fare}</span>
                            <span className="timeline-time">
                              {t.trip_start_time
                                ? formatDistanceToNow(new Date(t.trip_start_time), { addSuffix: true })
                                : '—'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <Ticket size={28} style={{ color: 'var(--text-subtle)' }} />
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No activity yet</div>
                    <Link to="/routes" className="btn btn-primary btn-sm">Book your first trip</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Route suggestions */}
          <div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Popular Routes</span>
                <Link to="/routes" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
                  All routes
                </Link>
              </div>
              <div style={{ padding: '4px 0' }}>
                {routesData?.results?.map(r => (
                  <Link
                    key={r.id}
                    to="/routes"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px', borderBottom: '1px solid var(--border)',
                      textDecoration: 'none', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius)',
                      background: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>
                        {r.route_number?.split('-')[1] || r.route_number}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>
                        {r.route_number}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.source} → {r.destination}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>₹{r.fare}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.distance} km</div>
                    </div>
                  </Link>
                )) || (
                  <div style={{ padding: '12px 16px' }}>
                    {Array(4).fill(0).map((_, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ width: '50%', height: 12, marginBottom: 4 }} />
                          <div className="skeleton" style={{ width: '80%', height: 10 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
