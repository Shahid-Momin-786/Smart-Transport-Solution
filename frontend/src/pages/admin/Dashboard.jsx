import { useQuery } from '@tanstack/react-query'
import { reportService, tripService, busService, notificationService } from '@/services/services'
import { useAuth } from '@/contexts/AuthContext'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts'
import {
  Users, Bus, Route, Ticket, CreditCard, TrendingUp,
  Activity, DollarSign, Plus, Bell, ArrowRight, AlertCircle,
  CheckCircle, Clock, MapPin,
} from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'

const QUICK_ACTIONS = [
  { label: 'New Trip', icon: MapPin, to: '/admin/trips', color: 'var(--primary)', bg: 'var(--primary-light)' },
  { label: 'Add Bus', icon: Bus, to: '/admin/buses', color: 'var(--success)', bg: 'var(--success-light)' },
  { label: 'Create Pass', icon: CreditCard, to: '/admin/passes', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { label: 'Notify Users', icon: Bell, to: '/admin/notifications', color: 'var(--warning)', bg: 'var(--warning-light)' },
]

function KPICard({ label, value, icon: Icon, iconColor, iconBg, suffix = '', delta }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ marginTop: 6 }}>
            {value !== undefined
              ? `${suffix}${typeof value === 'number' ? value.toLocaleString('en-IN') : value}`
              : <span className="skeleton" style={{ width: 80, height: 26, display: 'inline-block', borderRadius: 4 }} />
            }
          </div>
          {delta !== undefined && (
            <div className={`stat-delta ${delta >= 0 ? 'positive' : 'negative'}`} style={{ marginTop: 6 }}>
              <span>{delta >= 0 ? '↑' : '↓'}</span>
              <span>This month</span>
            </div>
          )}
        </div>
        <div className="stat-icon" style={{ background: iconBg || 'var(--surface-2)' }}>
          <Icon size={16} style={{ color: iconColor || 'var(--text-muted)' }} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 12px', boxShadow: 'var(--shadow-md)',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['report-stats'],
    queryFn: () => reportService.stats().then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: chartData } = useQuery({
    queryKey: ['ticket-chart'],
    queryFn: () => reportService.ticketChart(30).then(r => r.data),
  })

  const { data: routePerf } = useQuery({
    queryKey: ['route-performance'],
    queryFn: () => reportService.routePerformance().then(r => r.data),
  })

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            {user?.depot?.name || 'All Depots'} · {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="status-dot active pulse" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Live</span>
          </div>
        </div>
      </div>

      {/* System status banner */}
      {stats?.active_trips > 0 && (
        <div className="alert-banner success" style={{ marginBottom: 20 }}>
          <Activity size={14} />
          <span>
            <strong>{stats.active_trips}</strong> trips currently active across the network.
            All systems operational.
          </span>
        </div>
      )}

      {/* ── Primary KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 20 }}>
        <KPICard
          label="Monthly Revenue"
          value={stats?.revenue_this_month}
          suffix="₹"
          icon={DollarSign}
          iconColor="#16a34a"
          iconBg="var(--success-light)"
          delta={1}
        />
        <KPICard
          label="Active Trips"
          value={stats?.active_trips}
          icon={Activity}
          iconColor="var(--primary)"
          iconBg="var(--primary-light)"
        />
        <KPICard
          label="Total Passengers"
          value={stats?.total_passengers}
          icon={Users}
          iconColor="var(--info)"
          iconBg="var(--info-light)"
        />
        <KPICard
          label="Tickets This Month"
          value={stats?.tickets_this_month}
          icon={Ticket}
          iconColor="var(--warning)"
          iconBg="var(--warning-light)"
          delta={1}
        />
      </div>

      {/* ── Secondary KPI chips ── */}
      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Routes', val: stats?.total_routes, icon: Route, color: 'var(--primary)' },
          { label: 'Fleet Size', val: stats?.total_buses, icon: Bus, color: 'var(--success)' },
          { label: 'Active Passes', val: stats?.active_passes, icon: CreditCard, color: '#7c3aed' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Icon size={16} style={{ color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {val ?? <span className="skeleton" style={{ width: 40, height: 18, display: 'inline-block', borderRadius: 3 }} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Quick Actions
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(({ label, icon: Icon, to, color, bg }) => (
            <Link key={label} to={to} className="quick-action-btn">
              <div className="quick-action-icon" style={{ background: bg }}>
                <Icon size={16} style={{ color }} />
              </div>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ticket trend */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <span className="card-title">Ticket Revenue — Last 30 Days</span>
            <Link to="/admin/reports" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500 }}>
              Full report <ArrowRight size={11} style={{ display: 'inline' }} />
            </Link>
          </div>
          <div style={{ padding: '16px' }}>
            {chartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={d => format(new Date(d), 'd MMM')}
                    interval={4}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone" dataKey="tickets" name="Tickets"
                    stroke="#2563eb" strokeWidth={2}
                    fill="url(#ticketGrad)" dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: '#2563eb' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="skeleton" style={{ height: 220, borderRadius: 6 }} />
            )}
          </div>
        </div>

        {/* Route performance */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Routes</span>
          </div>
          <div style={{ padding: '16px' }}>
            {routePerf ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={routePerf.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category" dataKey="route_number"
                    tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
                    tickLine={false} axisLine={false} width={50}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="tickets" name="Tickets" fill="#2563eb" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="skeleton" style={{ height: 220, borderRadius: 6 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
