from django.urls import path
from .views import (
    DashboardStatsView, TicketChartView, RoutePerformanceView,
    ExportTicketsView, ExportPassesView
)

urlpatterns = [
    path('stats/', DashboardStatsView.as_view(), name='reports-stats'),
    path('ticket-chart/', TicketChartView.as_view(), name='reports-ticket-chart'),
    path('route-performance/', RoutePerformanceView.as_view(), name='reports-route-performance'),
    path('export/tickets/', ExportTicketsView.as_view(), name='reports-export-tickets'),
    path('export/passes/', ExportPassesView.as_view(), name='reports-export-passes'),
]
