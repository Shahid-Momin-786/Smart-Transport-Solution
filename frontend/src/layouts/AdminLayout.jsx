import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Bus, Route, Calendar, Ticket, CreditCard,
  BarChart3, Bell, Settings, ChevronLeft, ChevronRight, Moon, Sun,
  LogOut, Menu, X, Shield, CheckCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import toast from 'react-hot-toast'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/users', icon: Users, label: 'Users' },
      { to: '/admin/buses', icon: Bus, label: 'Buses' },
      { to: '/admin/routes', icon: Route, label: 'Routes' },
      { to: '/admin/schedules', icon: Calendar, label: 'Schedules' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
      { to: '/admin/passes', icon: CheckCircle, label: 'Pass Verification' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/buses': 'Buses',
  '/admin/routes': 'Routes',
  '/admin/schedules': 'Schedules',
  '/admin/tickets': 'Tickets',
  '/admin/passes': 'Pass Verification',
  '/admin/reports': 'Reports',
  '/admin/notifications': 'Notifications',
  '/admin/settings': 'Settings',
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  const pageTitle = PAGE_TITLES[location.pathname] || 'Admin'
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app-shell">
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
              <div className="sidebar-brand-sub">Admin Console</div>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <div className="sidebar-scroll">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="sidebar-group">
              {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? label : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="nav-icon" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Footer: user strip */}
        <div className="sidebar-footer">
          {/* Theme toggle + collapse */}
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

          {/* User strip */}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" style={{ background: '#7c3aed' }}>
              {initials}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">
                  {user?.is_superuser ? 'Super Admin' : 'Admin'} · {user?.depot?.name || 'All Depots'}
                </div>
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
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Admin</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>/</span>
            <span className="topbar-title">{pageTitle}</span>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Admin badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', background: 'rgba(124,58,237,0.08)',
              borderRadius: 'var(--radius-sm)', border: '1px solid rgba(124,58,237,0.15)',
            }}>
              <Shield size={11} style={{ color: '#7c3aed' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}>
                {user?.is_superuser ? 'Super Admin' : 'Admin'}
              </span>
            </div>

            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#7c3aed', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div className="hidden sm:block">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{user?.depot?.name || 'All Depots'}</div>
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
    </div>
  )
}
