import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService, depotService } from '@/services/services'
import { Search, Plus, X, UserCheck, UserX, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const ROLE_BADGE = { PASSENGER: 'badge-primary', ADMIN: 'badge-accent' }

function CreateUserModal({ onClose, depots }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'PASSENGER', depot: '', password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) return toast.error('Passwords do not match.')
    setLoading(true)
    try {
      await userService.create(form)
      toast.success('User created successfully.')
      queryClient.invalidateQueries(['admin-users'])
      onClose()
    } catch (err) {
      const errors = err.response?.data
      if (errors) {
        const msg = Object.values(errors).flat().join('. ')
        toast.error(msg)
      } else {
        toast.error('Failed to create user.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Create User</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Add a new passenger or admin account</p>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="PASSENGER">Passenger</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Depot *</label>
                <select className="form-input" value={form.depot} onChange={e => setForm(f => ({ ...f, depot: e.target.value }))} required>
                  <option value="">Select depot…</option>
                  {depots?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input type="password" className="form-input" value={form.confirm_password} onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))} required />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page],
    queryFn: () => userService.list({ search, role: roleFilter || undefined, page, page_size: 15 }).then(r => r.data),
  })

  const { data: depots } = useQuery({
    queryKey: ['depots'],
    queryFn: () => depotService.list().then(r => r.data.results),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => userService.activate(id),
    onSuccess: () => { toast.success('User activated.'); queryClient.invalidateQueries(['admin-users']) },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => userService.deactivate(id),
    onSuccess: () => { toast.success('User deactivated.'); queryClient.invalidateQueries(['admin-users']) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => userService.delete(id),
    onSuccess: () => { toast.success('User deleted.'); queryClient.invalidateQueries(['admin-users']) },
    onError: () => toast.error('Failed to delete user.'),
  })

  const users = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{data?.count || 0} registered users</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <Plus size={13} /> Create User
        </button>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                className="form-input search-input"
                style={{ width: 220 }}
                placeholder="Search by name or email…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <select className="form-input" style={{ width: 140 }} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}>
              <option value="">All roles</option>
              <option value="PASSENGER">Passenger</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data?.count || 0} users</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}>
            {Array(5).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 6, marginBottom: 8 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state"><p style={{ fontSize: 13 }}>No users found.</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Depot</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: u.role === 'ADMIN' ? '#7c3aed' : 'var(--primary)',
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {u.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{u.phone || <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-secondary'}`}>{u.role}</span></td>
                  <td style={{ fontSize: 12 }}>{u.depot_details?.name || <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`} />
                      <span style={{ fontSize: 12 }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{format(new Date(u.created_at), 'd MMM yyyy')}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {u.is_active ? (
                        <button className="btn btn-ghost btn-sm" title="Deactivate" onClick={() => deactivateMutation.mutate(u.id)}>
                          <UserX size={13} style={{ color: 'var(--warning)' }} />
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" title="Activate" onClick={() => activateMutation.mutate(u.id)}>
                          <UserCheck size={13} style={{ color: 'var(--success)' }} />
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Delete"
                        onClick={() => { if (confirm(`Delete ${u.name}?`)) deleteMutation.mutate(u.id) }}
                      >
                        <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.total_pages > 1 && (
          <div className="pagination" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{page} / {data.total_pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} depots={depots} />}
    </div>
  )
}
