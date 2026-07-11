import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { busService } from '@/services/services'
import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_BADGE = { ACTIVE: 'badge-success', INACTIVE: 'badge-secondary', MAINTENANCE: 'badge-warning' }

function BusModal({ bus, onClose }) {
  const [form, setForm] = useState({
    bus_number: bus?.bus_number || '',
    capacity: bus?.capacity || 40,
    status: bus?.status || 'ACTIVE',
    model: bus?.model || '',
    year: bus?.year || new Date().getFullYear(),
  })
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (bus) {
        await busService.update(bus.id, form)
        toast.success('Bus updated.')
      } else {
        await busService.create(form)
        toast.success('Bus added.')
      }
      queryClient.invalidateQueries(['admin-buses'])
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.bus_number?.[0] || 'Failed to save bus.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{bus ? 'Edit Bus' : 'Add Bus'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-3">
            <div className="form-group">
              <label className="form-label">Bus Number *</label>
              <input className="form-input" value={form.bus_number} onChange={e => setForm(f => ({...f, bus_number: e.target.value}))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input type="number" className="form-input" value={form.capacity} onChange={e => setForm(f => ({...f, capacity: +e.target.value}))} min={1} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Model</label>
                <input className="form-input" value={form.model} onChange={e => setForm(f => ({...f, model: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Year</label>
                <input type="number" className="form-input" value={form.year} onChange={e => setForm(f => ({...f, year: +e.target.value}))} min={2000} max={2030} />
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

export default function AdminBuses() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null) // null | 'create' | busObj
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-buses', search, statusFilter, page],
    queryFn: () => busService.list({ search, status: statusFilter || undefined, page, page_size: 15 }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => busService.delete(id),
    onSuccess: () => { toast.success('Bus deleted.'); queryClient.invalidateQueries(['admin-buses']) },
    onError: () => toast.error('Cannot delete bus (may have associated trips).'),
  })

  const buses = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Buses</h1>
          <p className="page-subtitle">{data?.count || 0} total buses</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}><Plus size={13} /> Add Bus</button>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input className="form-input search-input w-52" placeholder="Search buses…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="form-input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </div>
        </div>

        {isLoading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        : buses.length === 0 ? <div className="empty-state py-12 text-sm">No buses found.</div>
        : (
          <table className="table">
            <thead><tr><th>Bus #</th><th>Depot</th><th>Capacity</th><th>Model</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {buses.map(b => (
                <tr key={b.id}>
                  <td className="font-medium text-[var(--text-primary)] text-xs font-mono">{b.bus_number}</td>
                  <td className="text-xs">{b.depot_name}</td>
                  <td className="text-xs">{b.capacity} seats</td>
                  <td className="text-xs">{b.model || '—'}</td>
                  <td className="text-xs">{b.year || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(b)}><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Delete bus ${b.bus_number}?`)) deleteMutation.mutate(b.id) }}>
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

      {modal && <BusModal bus={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
