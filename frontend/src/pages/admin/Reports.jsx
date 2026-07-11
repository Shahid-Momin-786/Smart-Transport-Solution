import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/services'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { BarChart3, Download, TrendingUp, DollarSign, Ticket, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 shadow-md text-xs">
      <p className="font-semibold text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name.includes('Revenue') ? `₹${p.value.toLocaleString()}` : p.value}</p>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color = 'var(--primary)' }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="kpi-label">{label}</div>
          <div className="kpi-value mt-1">
            {value !== undefined ? value : <span className="skeleton w-16 h-8 inline-block rounded" />}
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

export default function AdminReports() {
  const [days, setDays] = useState(30)
  const [exporting, setExporting] = useState(null)

  const { data: stats } = useQuery({
    queryKey: ['report-stats'],
    queryFn: () => reportService.stats().then(r => r.data),
  })

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['ticket-chart', days],
    queryFn: () => reportService.ticketChart(days).then(r => r.data),
  })

  const { data: routePerf, isLoading: routeLoading } = useQuery({
    queryKey: ['route-performance'],
    queryFn: () => reportService.routePerformance().then(r => r.data),
  })

  const handleExport = async (type) => {
    setExporting(type)
    try {
      const res = type === 'tickets'
        ? await reportService.exportTickets()
        : await reportService.exportPasses()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_export.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully.`)
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  // Pie chart data from routePerf
  const pieData = routePerf?.slice(0, 6).map(r => ({
    name: r.route_number,
    value: r.tickets,
  })) || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Analytics &amp; data exports</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('tickets')}
            disabled={exporting === 'tickets'}
          >
            <Download className="w-3.5 h-3.5" />
            {exporting === 'tickets' ? 'Exporting…' : 'Export Tickets'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('passes')}
            disabled={exporting === 'passes'}
          >
            <Download className="w-3.5 h-3.5" />
            {exporting === 'passes' ? 'Exporting…' : 'Export Passes'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tickets" value={stats?.total_tickets?.toLocaleString()} icon={Ticket} />
        <StatCard label="Monthly Tickets" value={stats?.tickets_this_month?.toLocaleString()} icon={TrendingUp} color="var(--secondary)" />
        <StatCard label="Monthly Revenue" value={stats?.revenue_this_month !== undefined ? `₹${Number(stats.revenue_this_month).toLocaleString()}` : undefined} icon={DollarSign} color="#F59E0B" />
        <StatCard label="Active Passes" value={stats?.active_passes?.toLocaleString()} icon={CreditCard} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Ticket + Revenue Trend */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <span className="card-title text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
              Ticket &amp; Revenue Trend
            </span>
            <div className="flex items-center gap-1">
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDays(d)}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {chartLoading ? (
              <div className="skeleton h-56 rounded" />
            ) : chartData?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tickGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={d => format(new Date(d), 'd MMM')} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#2563EB" strokeWidth={2} fill="url(#tickGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10B981" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state py-10 text-sm">No data for selected period.</div>
            )}
          </div>
        </div>

        {/* Pie chart – ticket share by route */}
        <div className="card">
          <div className="card-header">
            <span className="card-title text-sm">Ticket Share by Route</span>
          </div>
          <div className="p-4 flex flex-col items-center">
            {routeLoading ? (
              <div className="skeleton w-full h-56 rounded" />
            ) : pieData.length ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 w-full space-y-1.5">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[var(--text-secondary)]">Route {d.name}</span>
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state py-10 text-sm">No route data.</div>
            )}
          </div>
        </div>
      </div>

      {/* Route Performance Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title text-sm">Route Performance</span>
        </div>
        {routeLoading ? (
          <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : routePerf?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Name</th>
                <th>Tickets Sold</th>
                <th>Revenue (₹)</th>
                <th>Avg Fare (₹)</th>
              </tr>
            </thead>
            <tbody>
              {routePerf.map((r, i) => (
                <tr key={r.route_number}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium text-[var(--text-primary)]">{r.route_number}</span>
                    </div>
                  </td>
                  <td className="text-xs">{r.route_name}</td>
                  <td className="text-xs font-medium text-[var(--text-primary)]">{r.tickets.toLocaleString()}</td>
                  <td className="text-xs font-medium text-[var(--secondary)]">₹{r.revenue.toLocaleString()}</td>
                  <td className="text-xs">{r.tickets > 0 ? `₹${(r.revenue / r.tickets).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state py-10 text-sm">No route data available.</div>
        )}
      </div>
    </div>
  )
}
