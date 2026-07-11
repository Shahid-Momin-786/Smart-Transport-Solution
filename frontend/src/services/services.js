import api from './api'

// Auth
export const authService = {
  login: (data) => api.post('/auth/login/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  refresh: (refresh) => api.post('/auth/refresh/', { refresh }),
  me: () => api.get('/auth/me/'),
  changePassword: (data) => api.post('/auth/change-password/', data),
  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),
  resetPassword: (data) => api.post('/auth/reset-password/', data),
  register: (data) => api.post('/auth/register/', data),
}


// Users
export const userService = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.patch(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  me: (data) => data ? api.patch('/users/me/', data) : api.get('/users/me/'),
  uploadPhoto: (file) => {
    const form = new FormData()
    form.append('profile_image', file)
    return api.post('/users/upload_photo/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  activate: (id) => api.post(`/users/${id}/activate/`),
  deactivate: (id) => api.post(`/users/${id}/deactivate/`),
}

// Depots
export const depotService = {
  list: (params) => api.get('/depots/', { params }),
  get: (id) => api.get(`/depots/${id}/`),
  create: (data) => api.post('/depots/', data),
  update: (id, data) => api.patch(`/depots/${id}/`, data),
}

// Buses
export const busService = {
  list: (params) => api.get('/buses/', { params }),
  get: (id) => api.get(`/buses/${id}/`),
  create: (data) => api.post('/buses/', data),
  update: (id, data) => api.patch(`/buses/${id}/`, data),
  delete: (id) => api.delete(`/buses/${id}/`),
}

// Routes
export const routeService = {
  list: (params) => api.get('/routes/', { params }),
  get: (id) => api.get(`/routes/${id}/`),
  create: (data) => api.post('/routes/', data),
  update: (id, data) => api.patch(`/routes/${id}/`, data),
  delete: (id) => api.delete(`/routes/${id}/`),
  stops: (id) => api.get(`/routes/${id}/stops/`),
  // Schedule / ETA endpoints
  search: (q) => api.get('/routes/search/', { params: { q } }),
  schedule: (id) => api.get(`/routes/${id}/schedule/`),
  eta: (id, tripId, boardingStopId) =>
    api.get(`/routes/${id}/eta/`, { params: { trip: tripId, boarding_stop: boardingStopId } }),
  nextBus: (id) => api.get(`/routes/${id}/next-bus/`),
  journeyPlanner: (source, destination) =>
    api.get('/routes/journey-planner/', { params: { source, destination } }),
}

// Trips (now schedule-aware)
export const tripService = {
  list: (params) => api.get('/trips/', { params }),
  get: (id) => api.get(`/trips/${id}/`),
  create: (data) => api.post('/trips/', data),
  update: (id, data) => api.patch(`/trips/${id}/`, data),
  delete: (id) => api.delete(`/trips/${id}/`),
  // Status actions
  start: (id) => api.post(`/trips/${id}/start/`),
  complete: (id) => api.post(`/trips/${id}/complete/`),
  cancel: (id) => api.post(`/trips/${id}/cancel/`),
  // Schedule actions
  today: (params) => api.get('/trips/today/', { params }),
  updateDelay: (id, delayMinutes, delayReason) =>
    api.post(`/trips/${id}/update-delay/`, { delay_minutes: delayMinutes, delay_reason: delayReason }),
}

// Bus Timings (replaces GPS tracking — schedule-based)
export const busTimingsService = {
  list: () => api.get('/tracking/buses/'),
}

// Tickets
export const ticketService = {
  list: (params) => api.get('/tickets/', { params }),
  get: (id) => api.get(`/tickets/${id}/`),
  book: (data) => api.post('/tickets/book/', data),
  myTickets: (params) => api.get('/tickets/my_tickets/', { params }),
  verify: (ticket_number) => api.post('/tickets/verify/', { ticket_number }),
  cancel: (id) => api.post(`/tickets/${id}/cancel/`),
}

// ─── Passes (original — backward compat) ────────────────────────────────────
export const passService = {
  list: (params) => api.get('/passes/', { params }),
  get: (id) => api.get(`/passes/${id}/`),
  create: (data) => api.post('/passes/', data),
  myPasses: (params) => api.get('/passes/my_passes/', { params }),
  verify: (pass_number) => api.post('/passes/verify/', { pass_number }),
  revoke: (id) => api.post(`/passes/${id}/revoke/`),
}

// ─── Pass Pricing ────────────────────────────────────────────────────────────
export const passPricingService = {
  list: (params) => api.get('/passes/pricing/', { params }),
  get: (id) => api.get(`/passes/pricing/${id}/`),
  create: (data) => api.post('/passes/pricing/', data),
  update: (id, data) => api.patch(`/passes/pricing/${id}/`, data),
  delete: (id) => api.delete(`/passes/pricing/${id}/`),
}

// ─── Daily Pass ──────────────────────────────────────────────────────────────
export const dailyPassService = {
  create: (data) => api.post('/passes/daily/', data),
  myList: (params) => api.get('/passes/daily/my_daily_passes/', { params }),
  list: (params) => api.get('/passes/daily/', { params }),
  pricing: () => api.get('/passes/daily/pricing/'),
}

// ─── Pass Applications ───────────────────────────────────────────────────────
export const passApplicationService = {
  create: (data) => api.post('/passes/applications/', data),
  myList: (params) => api.get('/passes/applications/my_applications/', { params }),
  list: (params) => api.get('/passes/applications/', { params }),
  get: (id) => api.get(`/passes/applications/${id}/`),
  review: (id, data) => api.post(`/passes/applications/${id}/review/`, data),
  requiredDocs: () => api.get('/passes/applications/required_docs/'),
}

// ─── Pass Documents ──────────────────────────────────────────────────────────
export const passDocumentService = {
  upload: (applicationId, docType, file) => {
    const form = new FormData()
    form.append('application', applicationId)
    form.append('doc_type', docType)
    form.append('file', file)
    return api.post('/passes/documents/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (id) => api.delete(`/passes/documents/${id}/`),
  list: (params) => api.get('/passes/documents/', { params }),
  verifyDocument: (id, is_verified) =>
    api.post(`/passes/documents/${id}/verify_document/`, { is_verified }),
}

// ─── Generated Passes ────────────────────────────────────────────────────────
export const generatedPassService = {
  myList: (params) => api.get('/passes/generated/my_generated_passes/', { params }),
  list: (params) => api.get('/passes/generated/', { params }),
  get: (id) => api.get(`/passes/generated/${id}/`),
  revoke: (id) => api.post(`/passes/generated/${id}/revoke/`),
}

// Notifications
export const notificationService = {
  list: (params) => api.get('/notifications/', { params }),
  create: (data) => api.post('/notifications/', data),
  markRead: (id) => api.post(`/notifications/${id}/mark_read/`),
  markAllRead: () => api.post('/notifications/mark_all_read/'),
  unreadCount: () => api.get('/notifications/unread_count/'),
}

// Reports
export const reportService = {
  stats: () => api.get('/reports/stats/'),
  ticketChart: (days = 30) => api.get('/reports/ticket-chart/', { params: { days } }),
  routePerformance: () => api.get('/reports/route-performance/'),
  exportTickets: () => api.get('/reports/export/tickets/', { responseType: 'blob' }),
  exportPasses: () => api.get('/reports/export/passes/', { responseType: 'blob' }),
}
