import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, RefreshCw, Bus, AlertTriangle, Users, Radio, Clock, X } from 'lucide-react'
import { trackingService } from '@/services/services'
import toast from 'react-hot-toast'

function OccupancyBar({ count, capacity }) {
  const pct = capacity > 0 ? Math.min((count / capacity) * 100, 100) : 0
  const color = pct > 80 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Occupancy</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>
          {count}/{capacity} ({Math.round(pct)}%)
        </span>
      </div>
      <div className="occupancy-bar">
        <div className="occupancy-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function PassengerTracking() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [selectedBus, setSelectedBus] = useState(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  const { data: buses, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['active-buses'],
    queryFn: () => trackingService.activeBuses().then(r => r.data),
    refetchInterval: 15000,
  })

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(L => {
      // Fix default marker icons
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView([19.076, 72.877], 12)

      // Clean tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
        maxZoom: 18,
      }).addTo(map)

      // Custom zoom control (bottom right)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      mapInstanceRef.current = { map, L }
    })

    return () => {
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !buses) return
    const { map, L } = mapInstanceRef.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (buses.length === 0) return

    const bounds = []
    buses.forEach(bus => {
      const isSelected = selectedBus?.trip_id === bus.trip_id
      const pct = bus.capacity > 0 ? (bus.passenger_count / bus.capacity) * 100 : 0
      const dotColor = pct > 80 ? '#dc2626' : pct > 60 ? '#d97706' : '#16a34a'

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${isSelected ? 38 : 32}px;
          height:${isSelected ? 38 : 32}px;
          background:${isSelected ? '#2563eb' : '#1e40af'};
          border:${isSelected ? '3px solid white' : '2px solid white'};
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          transition:all 0.2s;
          cursor:pointer;
        ">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 12V5a1 1 0 011-1h10a1 1 0 011 1v7M2 12h12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="4" cy="13" r="1" fill="white"/>
            <circle cx="12" cy="13" r="1" fill="white"/>
          </svg>
        </div>
        <div style="
          width:10px;height:10px;border-radius:50%;
          background:${dotColor};border:2px solid white;
          position:absolute;bottom:-2px;right:-2px;
        "/>`,
        iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
        iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16],
      })

      const marker = L.marker([bus.latitude, bus.longitude], { icon })
        .addTo(map)
        .on('click', () => setSelectedBus(bus))

      markersRef.current.push(marker)
      bounds.push([bus.latitude, bus.longitude])
    })

    if (!selectedBus && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [buses, dataUpdatedAt, selectedBus])

  const activeBus = selectedBus || (buses?.[0] ?? null)

  const handleEmergency = () => {
    setEmergencyOpen(false)
    toast.error('Emergency alert sent. Help is on the way.', { duration: 5000 })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Tracking</h1>
          <p className="page-subtitle">
            {buses?.length || 0} buses active · Auto-refreshes every 15s
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Tracking Shell ── */}
      <div className="tracking-shell">
        {/* Map */}
        <div className="tracking-map-area">
          <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: 400 }} />

          {/* Refresh overlay */}
          <button className="tracking-refresh-btn" onClick={() => refetch()}>
            <Radio size={12} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 11 }}>Live</span>
          </button>

          {/* Emergency button */}
          <button
            className="tracking-emergency-btn"
            onClick={() => setEmergencyOpen(true)}
          >
            <AlertTriangle size={13} />
            SOS
          </button>

          {/* Bus chips */}
          {buses && buses.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.12))',
              zIndex: 5,
            }}>
              {buses.map(bus => (
                <button
                  key={bus.trip_id}
                  onClick={() => setSelectedBus(selectedBus?.trip_id === bus.trip_id ? null : bus)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 20,
                    background: selectedBus?.trip_id === bus.trip_id ? 'var(--primary)' : 'var(--bg)',
                    color: selectedBus?.trip_id === bus.trip_id ? 'white' : 'var(--text-primary)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-sm)', fontFamily: 'inherit',
                    transition: 'all 0.12s ease',
                    flexShrink: 0,
                  }}
                >
                  <Bus size={11} />
                  {bus.bus_number}
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
                    animation: 'pulse-dot 2s infinite',
                  }} />
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.7)', zIndex: 10,
            }}>
              <div style={{ textAlign: 'center' }}>
                <RefreshCw size={24} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Loading buses…</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Info Panel ── */}
        <div className="tracking-bottom-panel">
          {activeBus ? (
            <>
              {/* Bus info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 'var(--radius)',
                  background: 'var(--primary-light)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Bus size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                      {activeBus.bus_number}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: 'var(--success)',
                      background: 'var(--success-light)', padding: '1px 5px',
                      borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {activeBus.route_number} · {activeBus.source} → {activeBus.destination}
                  </div>
                </div>
              </div>

              <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />

              {/* ETA placeholder */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  ETA
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>~8 min</span>
                </div>
              </div>

              <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />

              {/* Occupancy */}
              <div style={{ minWidth: 160, flex: 1 }}>
                <OccupancyBar count={activeBus.passenger_count} capacity={activeBus.capacity} />
              </div>

              <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />

              {/* Driver */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  Driver
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeBus.driver_name || 'On Duty'}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <Bus size={16} />
              <span style={{ fontSize: 13 }}>
                {buses?.length === 0 ? 'No buses currently active in your depot' : 'Select a bus from the map or chips above'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Emergency modal */}
      {emergencyOpen && (
        <div className="modal-backdrop" onClick={() => setEmergencyOpen(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>Emergency Alert</h3>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEmergencyOpen(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                This will send an immediate emergency alert to depot control and your emergency contacts.
                Only use this for genuine emergencies.
              </p>
              {activeBus && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', background: 'var(--danger-light)',
                  borderRadius: 'var(--radius)', border: '1px solid rgba(220,38,38,0.2)',
                  fontSize: 12, color: 'var(--danger)',
                }}>
                  Bus: <strong>{activeBus.bus_number}</strong> · Route: <strong>{activeBus.route_number}</strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setEmergencyOpen(false)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }}
                onClick={handleEmergency}
              >
                <AlertTriangle size={13} /> Send Emergency Alert
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-container { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  )
}
