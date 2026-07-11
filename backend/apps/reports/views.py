import io
import openpyxl
from datetime import date, timedelta
from django.http import HttpResponse
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model

from apps.tickets.models import Ticket
from apps.passes.models import Pass
from apps.buses.models import Bus
from apps.routes.models import Route
from apps.trips.models import Trip

User = get_user_model()


class IsAdminUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class DashboardStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        depot = request.user.depot if not request.user.is_superuser else None

        def qs_filter(qs, field='depot'):
            if depot:
                return qs.filter(**{field: depot})
            return qs

        today = timezone.now().date()
        month_start = today.replace(day=1)

        total_passengers = qs_filter(User.objects.filter(role='PASSENGER')).count()
        total_buses = qs_filter(Bus.objects.all()).count()
        total_routes = qs_filter(Route.objects.filter(is_active=True)).count()
        total_tickets = qs_filter(Ticket.objects.all()).count()
        total_passes = qs_filter(Pass.objects.all()).count()
        tickets_this_month = qs_filter(Ticket.objects.filter(booked_at__date__gte=month_start)).count()
        revenue_this_month = qs_filter(
            Ticket.objects.filter(booked_at__date__gte=month_start, status='CONFIRMED')
        ).aggregate(total=Sum('fare'))['total'] or 0
        active_trips = qs_filter(Trip.objects.filter(status='IN_PROGRESS')).count()
        active_passes = qs_filter(Pass.objects.filter(status='ACTIVE', valid_to__gte=today)).count()

        return Response({
            'total_passengers': total_passengers,
            'total_buses': total_buses,
            'total_routes': total_routes,
            'total_tickets': total_tickets,
            'total_passes': total_passes,
            'tickets_this_month': tickets_this_month,
            'revenue_this_month': float(revenue_this_month),
            'active_trips': active_trips,
            'active_passes': active_passes,
        })


class TicketChartView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        depot = request.user.depot if not request.user.is_superuser else None
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        qs = Ticket.objects.filter(booked_at__date__gte=start_date)
        if depot:
            qs = qs.filter(depot=depot)

        # Group by date
        from django.db.models.functions import TruncDate
        data = (
            qs.annotate(date=TruncDate('booked_at'))
            .values('date')
            .annotate(count=Count('id'), revenue=Sum('fare'))
            .order_by('date')
        )

        return Response([
            {
                'date': str(item['date']),
                'tickets': item['count'],
                'revenue': float(item['revenue'] or 0),
            }
            for item in data
        ])


class RoutePerformanceView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        depot = request.user.depot if not request.user.is_superuser else None
        qs = Route.objects.all()
        if depot:
            qs = qs.filter(depot=depot)

        data = []
        for route in qs[:10]:
            ticket_count = Ticket.objects.filter(trip__route=route).count()
            revenue = Ticket.objects.filter(
                trip__route=route, status='CONFIRMED'
            ).aggregate(total=Sum('fare'))['total'] or 0
            data.append({
                'route_number': route.route_number,
                'route_name': route.route_name,
                'tickets': ticket_count,
                'revenue': float(revenue),
            })
        data.sort(key=lambda x: x['tickets'], reverse=True)
        return Response(data)


class ExportTicketsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        depot = request.user.depot if not request.user.is_superuser else None
        qs = Ticket.objects.select_related('passenger', 'trip__route', 'trip__bus', 'depot')
        if depot:
            qs = qs.filter(depot=depot)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Tickets'
        headers = ['Ticket #', 'Passenger', 'Email', 'Route', 'Bus', 'Seat', 'Fare', 'Status', 'Booked At', 'Depot']
        ws.append(headers)

        for ticket in qs:
            ws.append([
                ticket.ticket_number,
                ticket.passenger.name,
                ticket.passenger.email,
                ticket.trip.route.route_number,
                ticket.trip.bus.bus_number,
                ticket.seat_number,
                float(ticket.fare),
                ticket.status,
                ticket.booked_at.strftime('%Y-%m-%d %H:%M'),
                ticket.depot.name,
            ])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="tickets_export.xlsx"'
        return response


class ExportPassesView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        depot = request.user.depot if not request.user.is_superuser else None
        qs = Pass.objects.select_related('passenger', 'depot')
        if depot:
            qs = qs.filter(depot=depot)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Passes'
        headers = ['Pass #', 'Passenger', 'Email', 'Type', 'Valid From', 'Valid To', 'Fare', 'Status', 'Depot']
        ws.append(headers)

        for p in qs:
            ws.append([
                p.pass_number,
                p.passenger.name,
                p.passenger.email,
                p.pass_type,
                str(p.valid_from),
                str(p.valid_to),
                float(p.fare),
                p.status,
                p.depot.name,
            ])

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="passes_export.xlsx"'
        return response
