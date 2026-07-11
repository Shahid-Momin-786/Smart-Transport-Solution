import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '@/services/services'
import { Bell, Check, CheckCheck, Ticket, CreditCard, Bus, Settings, Filter, X } from 'lucide-react'
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns'
import toast from 'react-hot-toast'

const CATEGORY_CONFIG = {
  ticket:  { icon: Ticket,     color: 'var(--primary)',  bg: 'var(--primary-light)',  label: 'Tickets'  },
  pass:    { icon: CreditCard, color: 'var(--success)',  bg: 'var(--success-light)',  label: 'Passes'   },
  trip:    { icon: Bus,        color: 'var(--warning)',  bg: 'var(--warning-light)',  label: 'Trips'    },
  system:  { icon: Settings,   color: 'var(--text-muted)', bg: 'var(--surface-2)',   label: 'System'   },
  default: { icon: Bell,       color: 'var(--info)',     bg: 'var(--info-light)',     label: 'General'  },
}

function detectCategory(notification) {
  const text = `${notification.title} ${notification.message}`.toLowerCase()
  if (text.includes('ticket') || text.includes('book')) return 'ticket'
  if (text.includes('pass')) return 'pass'
  if (text.includes('trip') || text.includes('bus') || text.includes('route')) return 'trip'
  if (text.includes('system') || text.includes('update') || text.includes('maintenance')) return 'system'
  return 'default'
}

function groupByDate(notifications) {
  const groups = {}
  notifications.forEach(n => {
    const d = new Date(n.created_at)
    let key
    if (isToday(d)) key = 'Today'
    else if (isYesterday(d)) key = 'Yesterday'
    else key = format(d, 'd MMMM yyyy')

    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  })
  return groups
}

const CATEGORY_TABS = ['All', 'Tickets', 'Passes', 'Trips', 'System']

export default function PassengerNotifications() {
  const [activeTab, setActiveTab] = useState('All')
  const [readFilter, setReadFilter] = useState('all') // 'all' | 'unread' | 'read'
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list({ page_size: 100 }).then(r => r.data),
  })

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries(['notifications', 'notifications-unread']),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications', 'notifications-unread'])
      toast.success('All notifications marked as read.')
    },
  })

  const all = data?.results || []
  const unread = all.filter(n => !n.is_read)

  // Filter by category tab
  let filtered = all
  if (activeTab !== 'All') {
    const tabKey = activeTab.toLowerCase().replace(/s$/, '') // "Tickets" → "ticket"
    filtered = all.filter(n => detectCategory(n) === tabKey)
  }

  // Filter by read state
  if (readFilter === 'unread') filtered = filtered.filter(n => !n.is_read)
  if (readFilter === 'read') filtered = filtered.filter(n => n.is_read)

  const grouped = groupByDate(filtered)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread.length} unread · {all.length} total</p>
        </div>
        {unread.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => markAllMutation.mutate()}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Category tabs */}
        <div className="filter-tabs">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab}
              className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab !== 'All' && (() => {
                const key = tab.toLowerCase().replace(/s$/, '')
                const count = all.filter(n => detectCategory(n) === key && !n.is_read).length
                return count > 0 ? (
                  <span style={{
                    marginLeft: 4, background: 'var(--danger)', color: 'white',
                    borderRadius: 99, fontSize: 9, fontWeight: 700,
                    padding: '0px 4px', minWidth: 14, textAlign: 'center',
                  }}>{count}</span>
                ) : null
              })()}
            </button>
          ))}
        </div>

        {/* Read filter */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {[['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([val, label]) => (
            <button
              key={val}
              className={`btn btn-sm ${readFilter === val ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setReadFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '0' }}>
            {Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '50%', height: 13, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '80%', height: 11 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Bell size={28} style={{ color: 'var(--text-subtle)' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {readFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {activeTab !== 'All' ? `No ${activeTab.toLowerCase()} notifications` : "You're all caught up!"}
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="notif-date-group">{dateLabel}</div>
              {items.map(n => {
                const cat = detectCategory(n)
                const cfg = CATEGORY_CONFIG[cat]
                const Icon = cfg.icon
                return (
                  <div
                    key={n.id}
                    className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                    onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id) }}
                  >
                    <div className="notification-icon" style={{ background: cfg.bg }}>
                      <Icon size={15} style={{ color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <p style={{
                          fontSize: 13, lineHeight: 1.4,
                          fontWeight: n.is_read ? 400 : 600,
                          color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                          flex: 1,
                        }}>
                          {n.title}
                        </p>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 4 }}>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {n.is_read ? (
                      <Check size={13} style={{ color: 'var(--text-subtle)', flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <div className="notification-unread-dot" />
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
