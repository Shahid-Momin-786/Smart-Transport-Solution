import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tripService, routeService, busService } from '@/services/services'
import { Search, Plus, X, Play, CheckSquare, Ban } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { SCHEDULED: 'badge-primary', IN_PROGRESS: 'badge-success', COMPLETED: 'badge-secondary', CANCELLED: 'badge-danger' }

function CreateTripModal({ onClose }) {
  const [form, setForm] = useState({ route: '', bus: '', start_time: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data: routes } = useQuery({ queryKey: ['routes-all'], queryFn: () => routeService.list({ page_size: 100 }).then(r => r.data.results) })
  const { data: buses } = useQuery({ queryKey: ['buses-active'], queryFn: () => busService.list({ status: 'ACTIVE', page_size: 100 }).then(r => r.data.results) })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await tripService.create(form)
      toast.success('Trip created.')
      queryClient.invalidateQueries(['admin-trips'])
      onClose()
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Failed to create trip.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Schedule Trip</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="form-group">
              <label className="form-label">Route *</label>
              <select className="form-input" value={form.route} onChange={e => setForm(f => ({...f, route: e.target.value}))} required>
                <option value="">Select route…</option>
                {routes?.map(r => <option key={r.id} value={r.id}>{r.route_number} · {r.source} → {r.destination}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bus *</label>
              <select className="form-input" value={form.bus} onChange={e => setForm(f => ({...f, bus: e.target.value}))} required>
                <option value="">Select bus…</option>
                {buses?.map(b => <option key={b.id} value={b.id}>{b.bus_number} ({b.capacity} seats)</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input type="datetime-local" className="form-input" value={form.start_time} onChange={e => setForm(f => ({...f, start_time: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Creating…' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminTrips() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-trips', search, statusFilter, page],
    queryFn: () => tripService.list({ search, status: statusFilter || undefined, page, page_size: 15 }).then(r => r.data),
  })

  const startMutation = useMutation({ mutationFn: (id) => tripService.start(id), onSuccess: () => { toast.success('Trip started.'); queryClient.invalidateQueries(['admin-trips']) } })
  const completeMutation = useMutation({ mutationFn: (id) => tripService.complete(id), onSuccess: () => { toast.success('Trip completed.'); queryClient.invalidateQueries(['admin-trips']) } })
  const cancelMutation = useMutation({ mutationFn: (id) => tripService.cancel(id), onSuccess: () => { toast.success('Trip cancelled.'); queryClient.invalidateQueries(['admin-trips']) } })

  const trips = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trips</h1><p className="page-subtitle">{data?.count || 0} total trips</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" /> Schedule Trip</button>
      </div>
      <div className="table-container">
        <div className="table-toolbar">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input className="form-input search-input w-52" placeholder="Search trips…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="form-input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {isLoading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        : trips.length === 0 ? <div className="empty-state py-12 text-sm">No trips found.</div>
        : (
          <table className="table">
            <thead><tr><th>ID</th><th>Route</th><th>Bus</th><th>Start Time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id}>
                  <td className="text-xs text-[var(--text-muted)]">#{t.id}</td>
                  <td>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">{t.route_number}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t.source} → {t.destination}</div>
                  </td>
                  <td className="text-xs font-mono">{t.bus_number}</td>
                  <td className="text-xs">{t.start_time ? format(new Date(t.start_time), 'dd MMM yyyy, HH:mm') : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span></td>
                  <td>
                    <div className="flex gap-1">
                      {t.status === 'SCHEDULED' && (
                        <button className="btn btn-ghost btn-sm" title="Start" onClick={() => startMutation.mutate(t.id)}><Play className="w-3.5 h-3.5 text-[var(--secondary)]" /></button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button className="btn btn-ghost btn-sm" title="Complete" onClick={() => completeMutation.mutate(t.id)}><CheckSquare className="w-3.5 h-3.5 text-[var(--primary)]" /></button>
                      )}
                      {['SCHEDULED', 'IN_PROGRESS'].includes(t.status) && (
                        <button className="btn btn-ghost btn-sm" title="Cancel" onClick={() => { if (confirm('Cancel trip?')) cancelMutation.mutate(t.id) }}><Ban className="w-3.5 h-3.5 text-[var(--danger)]" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data?.total_pages > 1 && (
          <div className="pagination justify-end">
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</button>
            <span className="text-sm text-[var(--text-muted)] px-3">{page} / {data.total_pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p+1)}>Next</button>
          </div>
        )}
      </div>
      {createOpen && <CreateTripModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
