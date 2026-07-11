import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketService } from '@/services/services'
import { Search, QrCode, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { CONFIRMED: 'badge-primary', USED: 'badge-success', CANCELLED: 'badge-danger', EXPIRED: 'badge-secondary' }

export default function AdminTickets() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', search, statusFilter, page],
    queryFn: () => ticketService.list({ search, status: statusFilter || undefined, page, page_size: 15 }).then(r => r.data),
  })

  const verifyMutation = useMutation({
    mutationFn: (number) => ticketService.verify(number),
    onSuccess: (res) => setVerifyResult(res.data),
    onError: () => toast.error('Ticket not found.'),
  })

  const tickets = data?.results || []

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tickets</h1><p className="page-subtitle">{data?.count || 0} total tickets</p></div>
        <div className="flex items-center gap-2">
          <input
            className="form-input w-44 text-xs"
            placeholder="Enter ticket # to verify…"
            value={verifyInput}
            onChange={e => setVerifyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { verifyMutation.mutate(verifyInput); setVerifyInput('') } }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => { verifyMutation.mutate(verifyInput); setVerifyInput('') }}>
            <QrCode className="w-3.5 h-3.5" /> Verify
          </button>
        </div>
      </div>

      {verifyResult && (
        <div className={`mb-4 p-3 rounded border text-sm flex items-start justify-between gap-3 ${verifyResult.valid ? 'bg-[var(--secondary)]/10 border-[var(--secondary)]/30' : 'bg-[var(--danger)]/10 border-[var(--danger)]/30'}`}>
          <div>
            <span className={`font-semibold ${verifyResult.valid ? 'text-[var(--secondary)]' : 'text-[var(--danger)]'}`}>
              {verifyResult.valid ? '✓ Valid ticket — marked as USED' : '✗ Invalid ticket'}
            </span>
            {verifyResult.ticket && <span className="ml-2 text-[var(--text-muted)] text-xs">· {verifyResult.ticket.ticket_number} · {verifyResult.ticket.passenger_name}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setVerifyResult(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input className="form-input search-input w-56" placeholder="Search by ticket # or passenger…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <select className="form-input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
              <option value="">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="USED">Used</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {isLoading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}</div>
        : tickets.length === 0 ? <div className="empty-state py-12 text-sm">No tickets found.</div>
        : (
          <table className="table">
            <thead><tr><th>Ticket #</th><th>Passenger</th><th>Route</th><th>Bus</th><th>Seat</th><th>Fare</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td className="font-mono text-xs text-[var(--primary)]">{t.ticket_number}</td>
                  <td>
                    <div className="text-xs font-medium text-[var(--text-primary)]">{t.passenger_name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t.passenger_email}</div>
                  </td>
                  <td className="text-xs"><span className="font-semibold">{t.route_number}</span> · {t.source} → {t.destination}</td>
                  <td className="text-xs font-mono">{t.bus_number}</td>
                  <td className="text-xs font-medium">{t.seat_number}</td>
                  <td className="text-xs font-medium text-[var(--text-primary)]">₹{t.fare}</td>
                  <td className="text-xs">{t.booked_at ? format(new Date(t.booked_at), 'dd MMM yyyy') : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span></td>
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
    </div>
  )
}
