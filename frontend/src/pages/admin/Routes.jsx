import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { routeService } from '@/services/services'
import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

function RouteModal({ route, onClose }) {
  const [form, setForm] = useState({
    route_number: route?.route_number || '',
    route_name: route?.route_name || '',
    source: route?.source || '',
    destination: route?.destination || '',
    distance: route?.distance || '',
    fare: route?.fare || '',
    is_active: route?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (route) await routeService.update(route.id, form)
      else await routeService.create(form)
      toast.success(route ? 'Route updated.' : 'Route created.')
      queryClient.invalidateQueries(['admin-routes'])
      onClose()
    } catch (err) {
      toast.error(Object.values(err.response?.data || {}).flat().join('. ') || 'Failed to save route.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{route ? 'Edit Route' : 'Create Route'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Route Number *</label>
                <input className="form-input" value={form.route_number} onChange={e => setForm(f => ({...f, route_number: e.target.value}))} required />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Route Name *</label>
                <input className="form-input" value={form.route_name} onChange={e => setForm(f => ({...f, route_name: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Source *</label>
                <input className="form-input" value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Destination *</label>
                <input className="form-input" value={form.destination} onChange={e => setForm(f => ({...f, destination: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Distance (km) *</label>
                <input type="number" step="0.1" className="form-input" value={form.distance} onChange={e => setForm(f => ({...f, distance: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Fare (₹) *</label>
                <input type="number" step="0.01" className="form-input" value={form.fare} onChange={e => setForm(f => ({...f, fare: e.target.value}))} required />
              </div>
              <div className="form-group col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} className="rounded" />
                <label htmlFor="is_active" className="form-label cursor-pointer">Active</label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminRoutes() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-routes', search, page],
    queryFn: () => routeService.list({ search, page, page_size: 15 }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => routeService.delete(id),
    onSuccess: () => { toast.success('Route deleted.'); queryClient.invalidateQueries(['admin-routes']) },
    onError: () => toast.error('Cannot delete route.'),
  })

  const routes = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Routes</h1><p className="page-subtitle">{data?.count || 0} total routes</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}><Plus className="w-3.5 h-3.5" /> Add Route</button>
      </div>
      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input className="form-input search-input w-56" placeholder="Search routes…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
        {isLoading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        : routes.length === 0 ? <div className="empty-state py-12 text-sm">No routes found.</div>
        : (
          <table className="table">
            <thead><tr><th>Route #</th><th>Name</th><th>Source → Destination</th><th>Distance</th><th>Fare</th><th>Stops</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td className="font-semibold text-[var(--primary)] text-xs">{r.route_number}</td>
                  <td className="text-xs font-medium text-[var(--text-primary)]">{r.route_name}</td>
                  <td className="text-xs text-[var(--text-muted)]">{r.source} → {r.destination}</td>
                  <td className="text-xs">{r.distance} km</td>
                  <td className="text-xs font-medium">₹{r.fare}</td>
                  <td className="text-xs">{r.stop_count}</td>
                  <td><span className={`badge ${r.is_active ? 'badge-success' : 'badge-secondary'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Delete route?')) deleteMutation.mutate(r.id) }}>
                        <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
                      </button>
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
      {modal && <RouteModal route={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
