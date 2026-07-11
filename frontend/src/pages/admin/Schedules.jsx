import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, Bus, Route, Plus, Edit2, Trash2, X,
  CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw,
  Navigation, Timer, Save, ChevronDown,
} from 'lucide-react'
import { tripService, routeService, busService } from '@/services/services'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, delayMinutes }) {
  const map = {
    ON_TIME:   { label: 'On Time',   color: 'var(--success)', bg: 'rgba(34,197,94,0.1)',  icon: CheckCircle },
    SCHEDULED: { label: 'Scheduled', color: 'var(--primary)', bg: 'var(--primary-light)',  icon: Calendar },
    DELAYED:   { label: `Delayed ${delayMinutes}m`, color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
    CANCELLED: { label: 'Cancelled', color: 'var(--danger)', bg: 'rgba(220,38,38,0.1)',  icon: XCircle },
    IN_PROGRESS: { label: 'In Transit', color: 'var(--primary)', bg: 'var(--primary-light)', icon: Navigation },
    COMPLETED: { label: 'Completed', color: 'var(--text-muted)', bg: 'var(--surface-2)', icon: CheckCircle },
  }
  const cfg = map[status] || map['SCHEDULED']
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20 }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Schedule Form Modal ───────────────────────────────────────────────────────
function ScheduleModal({ trip, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!trip

  const { data: routesData } = useQuery({
    queryKey: ['routes-all'],
    queryFn: () => routeService.list({ page_size: 100 }).then(r => r.data),
  })
  const { data: busesData } = useQuery({
    queryKey: ['buses-all'],
    queryFn: () => busService.list({ page_size: 100 }).then(r => r.data),
  })

  const [form, setForm] = useState({
    route: trip?.route || '',
    bus: trip?.bus || '',
    departure_time: trip?.departure_time || '',
    arrival_time: trip?.arrival_time || '',
    frequency: trip?.frequency || 0,
    avg_stop_minutes: trip?.avg_stop_minutes || 3,
    status: trip?.status || 'SCHEDULED',
    notes: trip?.notes || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? tripService.update(trip.id, data)
      : tripService.create(data),
    onSuccess: () => {
      qc.invalidateQueries(['trips'])
      toast.success(isEdit ? 'Schedule updated!' : 'Schedule created!')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save schedule.'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.route || !form.bus || !form.departure_time) {
      return toast.error('Route, bus, and departure time are required.')
    }
    mutation.mutate({
      ...form,
      frequency: Number(form.frequency),
      avg_stop_minutes: Number(form.avg_stop_minutes),
    })
  }

  const routes = routesData?.results || []
  const buses = busesData?.results || []

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{isEdit ? 'Edit Schedule' : 'New Schedule'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {isEdit ? `Editing trip #${trip.id}` : 'Add a new bus trip to the schedule'}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Route */}
              <div className="form-group">
                <label className="form-label">Route *</label>
                <select className="form-input" value={form.route} onChange={e => set('route', e.target.value)} required>
                  <option value="">Select route…</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.route_number} · {r.source} → {r.destination}</option>
                  ))}
                </select>
              </div>

              {/* Bus */}
              <div className="form-group">
                <label className="form-label">Bus *</label>
                <select className="form-input" value={form.bus} onChange={e => set('bus', e.target.value)} required>
                  <option value="">Select bus…</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.bus_number}</option>
                  ))}
                </select>
              </div>

              {/* Departure */}
              <div className="form-group">
                <label className="form-label">Departure Time *</label>
                <input type="time" className="form-input" value={form.departure_time} onChange={e => set('departure_time', e.target.value)} required />
              </div>

              {/* Arrival */}
              <div className="form-group">
                <label className="form-label">Arrival Time</label>
                <input type="time" className="form-input" value={form.arrival_time} onChange={e => set('arrival_time', e.target.value)} />
              </div>

              {/* Frequency */}
              <div className="form-group">
                <label className="form-label">Frequency (minutes)</label>
                <input
                  type="number" className="form-input" min={0} max={120}
                  placeholder="0 = single trip"
                  value={form.frequency}
                  onChange={e => set('frequency', e.target.value)}
                />
                <p className="form-help">e.g. 15 = bus every 15 minutes</p>
              </div>

              {/* Avg stop minutes */}
              <div className="form-group">
                <label className="form-label">Avg. Stop Time (min)</label>
                <input
                  type="number" className="form-input" min={1} max={30}
                  value={form.avg_stop_minutes}
                  onChange={e => set('avg_stop_minutes', e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ON_TIME">On Time</option>
                <option value="DELAYED">Delayed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Optional remarks…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={mutation.isPending}>
              {mutation.isPending
                ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                : <><Save size={13} /> {isEdit ? 'Update' : 'Create'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delay Modal ───────────────────────────────────────────────────────────────
function DelayModal({ trip, onClose }) {
  const qc = useQueryClient()
  const [minutes, setMinutes] = useState(trip.delay_minutes || 0)
  const [reason, setReason] = useState(trip.delay_reason || '')

  const mutation = useMutation({
    mutationFn: () => tripService.updateDelay(trip.id, minutes, reason),
    onSuccess: () => {
      qc.invalidateQueries(['trips'])
      toast.success(minutes > 0 ? `Delay of ${minutes} min recorded.` : 'Delay cleared. Status set to On Time.')
      onClose()
    },
    onError: () => toast.error('Failed to update delay.'),
  })

  const presets = [0, 5, 10, 15, 20, 30]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Update Delay</h3>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Bus <strong>{trip.bus_number}</strong> · Route <strong>{trip.route_number}</strong> · Dep: <strong>{trip.departure_display}</strong>
          </div>

          {/* Preset buttons */}
          <div className="form-group">
            <label className="form-label">Delay Minutes</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMinutes(p)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: minutes === p ? 'var(--primary)' : 'var(--surface-2)',
                    color: minutes === p ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${minutes === p ? 'var(--primary)' : 'var(--border)'}`,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  }}
                >
                  {p === 0 ? 'No delay' : `+${p}m`}
                </button>
              ))}
            </div>
            <input
              type="number" className="form-input" min={0} max={120}
              value={minutes}
              onChange={e => setMinutes(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason</label>
            <input
              type="text" className="form-input"
              placeholder="e.g. Traffic, Breakdown, Weather…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {minutes > 0 && (
            <div style={{
              padding: '10px 12px', background: 'rgba(245,158,11,0.08)',
              borderRadius: 'var(--radius)', border: '1px solid rgba(245,158,11,0.25)',
              fontSize: 12, color: 'var(--warning)',
            }}>
              ⚠ Status will be automatically set to <strong>Delayed</strong>
            </div>
          )}
          {minutes === 0 && trip.status === 'DELAYED' && (
            <div style={{
              padding: '10px 12px', background: 'rgba(34,197,94,0.08)',
              borderRadius: 'var(--radius)', border: '1px solid rgba(34,197,94,0.25)',
              fontSize: 12, color: 'var(--success)',
            }}>
              ✓ Delay cleared — status will revert to <strong>On Time</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending
              ? <><Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
              : <><Save size={13} /> Update</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSchedules() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTrip, setEditTrip] = useState(null)
  const [delayTrip, setDelayTrip] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trips', filterStatus, page],
    queryFn: () => tripService.list({ status: filterStatus || undefined, page, page_size: 20, ordering: 'departure_time' }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => tripService.delete(id),
    onSuccess: () => { qc.invalidateQueries(['trips']); toast.success('Schedule deleted.') },
    onError: () => toast.error('Could not delete schedule.'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => tripService.cancel(id),
    onSuccess: () => { qc.invalidateQueries(['trips']); toast.success('Trip cancelled.') },
  })

  const trips = data?.results || []

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'ON_TIME', label: 'On Time' },
    { value: 'DELAYED', label: 'Delayed' },
    { value: 'IN_PROGRESS', label: 'In Transit' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedules</h1>
          <p className="page-subtitle">Manage bus schedules, departure times, and delays</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTrip(null); setShowModal(true) }}>
            <Plus size={13} /> New Schedule
          </button>
        </div>
      </div>

      {/* Stats row */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Today', value: data.count, color: 'var(--text-primary)' },
            { label: 'On Time', value: trips.filter(t => ['SCHEDULED', 'ON_TIME'].includes(t.status)).length, color: 'var(--success)' },
            { label: 'Delayed', value: trips.filter(t => t.status === 'DELAYED').length, color: 'var(--warning)' },
            { label: 'Cancelled', value: trips.filter(t => t.status === 'CANCELLED').length, color: 'var(--danger)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select
          className="form-input"
          style={{ width: 160 }}
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data?.count || 0} schedules</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="card skeleton" style={{ height: 68 }} />)}
        </div>
      ) : trips.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <Calendar size={36} style={{ color: 'var(--text-subtle)', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No schedules found</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Create your first schedule to get started</div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTrip(null); setShowModal(true) }}>
            <Plus size={13} /> New Schedule
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trips.map(trip => (
            <motion.div
              key={trip.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card"
              style={{ padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Bus + Route */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bus size={16} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{trip.bus_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '1px 6px', borderRadius: 4 }}>
                        {trip.route_number}
                      </span>
                      <StatusBadge status={trip.status} delayMinutes={trip.delay_minutes} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {trip.source} → {trip.destination}
                    </div>
                  </div>
                </div>

                {/* Times */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 2 }}>Departure</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {trip.departure_display || '—'}
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-subtle)', fontSize: 12 }}>→</div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 2 }}>Arrival</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {trip.arrival_display || '—'}
                    </div>
                  </div>
                  {trip.frequency > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-subtle)', marginBottom: 2 }}>Every</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{trip.frequency}m</div>
                    </div>
                  )}
                  {trip.delay_minutes > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--warning)', marginBottom: 2 }}>Delay</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>+{trip.delay_minutes}m</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDelayTrip(trip)}
                    title="Update delay"
                    style={{ color: 'var(--warning)' }}
                  >
                    <Timer size={13} /> Delay
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => { setEditTrip(trip); setShowModal(true) }}
                    title="Edit schedule"
                  >
                    <Edit2 size={13} />
                  </button>
                  {!['COMPLETED', 'CANCELLED'].includes(trip.status) && (
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => { if (confirm(`Cancel trip for ${trip.bus_number}?`)) cancelMutation.mutate(trip.id) }}
                      title="Cancel trip"
                      style={{ color: 'var(--danger)' }}
                    >
                      <XCircle size={13} />
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => { if (confirm('Delete this schedule permanently?')) deleteMutation.mutate(trip.id) }}
                    title="Delete"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.total_pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 8px' }}>{page} / {data.total_pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <ScheduleModal
            trip={editTrip}
            onClose={() => { setShowModal(false); setEditTrip(null) }}
          />
        )}
        {delayTrip && (
          <DelayModal
            trip={delayTrip}
            onClose={() => setDelayTrip(null)}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
