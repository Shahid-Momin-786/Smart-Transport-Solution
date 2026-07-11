import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Route, Clock, Ticket, CreditCard,
  Bell, User, ChevronLeft, ChevronRight, Moon, Sun,
  LogOut, Menu, X, ChevronDown, Zap, FileText, ClipboardList, Shield,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useQuery } from '@tanstack/react-query'
import { notificationService } from '@/services/services'
import toast from 'react-hot-toast'

const PASS_SUBMENU = [
  { to: '/passes/daily', icon: Zap, label: 'Daily Pass' },
  { to: '/passes/apply', icon: FileText, label: 'Apply Pass' },
  { to: '/passes/applications', icon: ClipboardList, label: 'My Applications' },
  { to: '/passes/my', icon: Shield, label: 'My Passes' },
]

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/routes', icon: Route, label: 'Routes' },
      { to: '/bus-timings', icon: Clock, label: 'Bus Timings' },
    ],
  },
  {
    label: 'My Travel',
    items: [
      { to: '/tickets', icon: Ticket, label: 'My Tickets' },
      // Pass Management is rendered as a separate collapsible group below
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
      { to: '/profile', icon: User, label: 'Profile' },
    ],
  },
]

const ALL_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/routes', icon: Route, label: 'Routes' },
  { to: '/bus-timings', icon: Clock, label: 'Bus Timings' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/passes/my', icon: CreditCard, label: 'Passes' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/profile', icon: User, label: 'Profile' },
]

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/routes': 'Routes',
  '/bus-timings': 'Bus Timings & ETA',
  '/tickets': 'My Tickets',
  '/passes/daily': 'Daily Pass',
  '/passes/apply': 'Apply Pass',
  '/passes/applications': 'My Applications',
  '/passes/my': 'My Passes',
  '/notifications': 'Notifications',
  '/profile': 'Profile',
}

export default function PassengerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [passMenuOpen, setPassMenuOpen] = useState(true) // default expanded
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationService.unreadCount().then(r => r.data),
    refetchInterval: 30000,
  })
  const unreadCount = unreadData?.unread_count || 0

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  const pageTitle = PAGE_TITLES[location.pathname] || 'Smart Transport'
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const isPassRoute = location.pathname.startsWith('/passes')

  // Auto-expand pass menu if on a pass route
  const passMenuExpanded = passMenuOpen || isPassRoute

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <nav className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 12V5a1 1 0 011-1h10a1 1 0 011 1v7M2 12h12M5 11V8M8 11V7M11 11V9"
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="4" cy="13" r="1" fill="white"/>
              <circle cx="12" cy="13" r="1" fill="white"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">Smart Transport</div>
              <div className="sidebar-brand-sub">Passenger Portal</div>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <div className="sidebar-scroll">
          {/* Main group */}
          <div className="sidebar-group">
            {!collapsed && <div className="sidebar-group-label">Main</div>}
            {[
              { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { to: '/routes', icon: Route, label: 'Routes' },
              { to: '/bus-timings', icon: Clock, label: 'Bus Timings' },
            ].map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? label : ''}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="nav-icon" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>

          {/* My Travel group */}
          <div className="sidebar-group">
            {!collapsed && <div className="sidebar-group-label">My Travel</div>}
            <NavLink
              to="/tickets"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? 'My Tickets' : ''}
              onClick={() => setMobileOpen(false)}
            >
              <Ticket className="nav-icon" />
              {!collapsed && <span>My Tickets</span>}
            </NavLink>

            {/* Pass Management — collapsible */}
            {collapsed ? (
              // When sidebar is collapsed, show just the icon linking to My Passes
              <NavLink
                to="/passes/my"
                className={({ isActive }) => `nav-item ${isActive || isPassRoute ? 'active' : ''}`}
                title="Pass Management"
                onClick={() => setMobileOpen(false)}
              >
                <CreditCard className="nav-icon" />
              </NavLink>
            ) : (
              <>
                {/* Pass Management header toggle */}
                <button
                  onClick={() => setPassMenuOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 12px',
                    borderRadius: 'var(--radius)', background: 'none', border: 'none',
                    cursor: 'pointer', color: isPassRoute ? 'var(--primary)' : 'var(--text-secondary)',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: isPassRoute ? 600 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  <CreditCard size={15} style={{ flexShrink: 0, color: isPassRoute ? 'var(--primary)' : 'var(--text-subtle)' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Pass Management</span>
                  <ChevronDown
                    size={13}
                    style={{
                      color: 'var(--text-subtle)',
                      transform: passMenuExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>

                {/* Submenu */}
                <AnimatePresence>
                  {passMenuExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ paddingLeft: 12 }}>
                        {PASS_SUBMENU.map(({ to, icon: Icon, label }) => (
                          <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            style={{ fontSize: 12 }}
                            onClick={() => setMobileOpen(false)}
                          >
                            <Icon className="nav-icon" style={{ width: 13, height: 13 }} />
                            <span>{label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Account group */}
          <div className="sidebar-group">
            {!collapsed && <div className="sidebar-group-label">Account</div>}
            <NavLink
              to="/notifications"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? 'Notifications' : ''}
              onClick={() => setMobileOpen(false)}
            >
              <div style={{ position: 'relative' }}>
                <Bell className="nav-icon" />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 14, height: 14, background: 'var(--danger)',
                    color: 'white', fontSize: 9, fontWeight: 700,
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!collapsed && <span>Notifications</span>}
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? 'Profile' : ''}
              onClick={() => setMobileOpen(false)}
            >
              <User className="nav-icon" />
              {!collapsed && <span>Profile</span>}
            </NavLink>
          </div>
        </div>

        {/* Footer: user strip */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggle}
              title="Toggle theme"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
              {!collapsed && <span style={{ fontSize: 11 }}>{dark ? 'Light' : 'Dark'}</span>}
            </button>
            <button
              className="btn btn-ghost btn-sm hidden md:flex"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.profile_image_url
                ? <img src={user.profile_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">{user?.depot?.name || 'Passenger'}</div>
              </div>
            )}
            {!collapsed && (
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Topbar */}
        <header className="topbar">
          <button
            className="btn btn-ghost btn-sm md:hidden"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <div className="topbar-breadcrumb">
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Smart Transport</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>/</span>
            <span className="topbar-title">{pageTitle}</span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NavLink to="/notifications" style={{ position: 'relative', display: 'flex' }}>
              <button className="btn btn-ghost btn-sm btn-icon">
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 7, height: 7, background: 'var(--danger)',
                    borderRadius: '50%', border: '1.5px solid var(--bg)',
                  }} />
                )}
              </button>
            </NavLink>

            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0, overflow: 'hidden',
              }}>
                {user?.profile_image_url
                  ? <img src={user.profile_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <div className="hidden sm:block">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{user?.depot?.name || 'Passenger'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="page-content">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav">
        {ALL_NAV_ITEMS.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
              }`
            }
          >
            <Icon style={{ width: 18, height: 18 }} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
