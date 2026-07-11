import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService, userService } from '@/services/services'
import { Bell, Check, CheckCheck, Megaphone, User as UserIcon, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, formatDistanceToNow } from 'date-fns'

export default function AdminNotifications() {
  const [form, setForm] = useState({ title: '', message: '', broadcast: true, user: '' })
  const [sending, setSending] = useState(false)
  const [readFilter, setReadFilter] = useState('')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-notifications', readFilter, page],
    queryFn: () => notificationService.list({
      is_read: readFilter === '' ? undefined : readFilter,
      page, page_size: 20,
    }).then(r => r.data),
  })

  const { data: usersData } = useQuery({
    queryKey: ['passenger-users'],
    queryFn: () => userService.list({ role: 'PASSENGER', page_size: 200 }).then(r => r.data.results),
    enabled: !form.broadcast,
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries(['admin-notifications']),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => { toast.success('All marked as read.'); queryClient.invalidateQueries(['admin-notifications']) },
  })

  const handleSend = async (e) => {
    e.preventDefault()
    if (!form.broadcast && !form.user) return toast.error('Select a passenger or enable broadcast.')
    setSending(true)
    try {
      await notificationService.create({
        title: form.title,
        message: form.message,
        broadcast: form.broadcast,
        user: form.broadcast ? undefined : form.user || undefined,
      })
      toast.success(form.broadcast ? 'Broadcast sent to all passengers!' : 'Notification sent!')
      queryClient.invalidateQueries(['admin-notifications'])
      setForm({ title: '', message: '', broadcast: true, user: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send notification.')
    } finally {
      setSending(false)
    }
  }

  const notifications = data?.results || []
  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{data?.count || 0} total · {unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Compose Panel ── */}
        <div className="card" style={{ position: 'sticky', top: 'calc(var(--topbar-height) + 24px)' }}>
          <div className="card-header">
            <span className="card-title">Compose Notification</span>
          </div>
          <form onSubmit={handleSend}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Target toggle */}
              <div>
                <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Send to</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, broadcast: true, user: '' }))}
                    style={{
                      flex: 1, padding: '7px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
                      background: form.broadcast ? 'var(--primary)' : 'var(--bg)',
                      color: form.broadcast ? 'white' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Megaphone size={12} /> All Passengers
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, broadcast: false }))}
                    style={{
                      flex: 1, padding: '7px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      borderLeft: '1px solid var(--border)', fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
                      background: !form.broadcast ? 'var(--primary)' : 'var(--bg)',
                      color: !form.broadcast ? 'white' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <UserIcon size={12} /> Specific User
                  </button>
                </div>
              </div>

              {!form.broadcast && (
                <div className="form-group">
                  <label className="form-label">Passenger *</label>
                  <select className="form-input" value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} required={!form.broadcast}>
                    <option value="">Select passenger…</option>
                    {usersData?.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Service update on Route 5"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea
                  className="form-input"
                  rows={5}
                  placeholder="Write your notification message here…"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending}>
                <Send size={13} />
                {sending ? 'Sending…' : form.broadcast ? 'Broadcast to all' : 'Send notification'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Notifications List ── */}
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="filter-tabs">
              {[['', 'All'], ['false', 'Unread'], ['true', 'Read']].map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-tab ${readFilter === val ? 'active' : ''}`}
                  onClick={() => { setReadFilter(val); setPage(1) }}
                >
                  {label}
                  {val === 'false' && unreadCount > 0 && (
                    <span style={{
                      marginLeft: 4, background: 'var(--danger)', color: 'white',
                      borderRadius: 99, fontSize: 9, fontWeight: 700,
                      padding: '0px 4px', minWidth: 14, textAlign: 'center',
                    }}>{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            {isLoading ? (
              <div style={{ padding: 16 }}>
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ width: '60%', height: 13, marginBottom: 6 }} />
                      <div className="skeleton" style={{ width: '90%', height: 11 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <Bell size={28} style={{ color: 'var(--text-subtle)' }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notifications.</div>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notification-item ${!n.is_read ? 'unread' : ''}`}>
                  <div className="notification-icon" style={{
                    background: !n.is_read ? 'var(--primary-light)' : 'var(--surface-2)',
                  }}>
                    <Bell size={15} style={{ color: !n.is_read ? 'var(--primary)' : 'var(--text-muted)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{
                        fontSize: 13, fontWeight: n.is_read ? 400 : 600,
                        color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                        flex: 1,
                      }}>
                        {n.title}
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--text-subtle)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                        {format(new Date(n.created_at), 'd MMM, HH:mm')}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</p>
                    {n.user_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <UserIcon size={10} style={{ color: 'var(--text-subtle)' }} />
                        <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{n.user_name}</span>
                      </div>
                    )}
                    {n.broadcast && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 600, color: 'var(--primary)',
                          background: 'var(--primary-light)', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>Broadcast</span>
                      </div>
                    )}
                  </div>
                  {!n.is_read && (
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Mark as read"
                      onClick={() => markReadMutation.mutate(n.id)}
                      style={{ flexShrink: 0 }}
                    >
                      <Check size={13} style={{ color: 'var(--success)' }} />
                    </button>
                  )}
                </div>
              ))
            )}

            {data && data.total_pages > 1 && (
              <div className="pagination" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{page} / {data.total_pages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
