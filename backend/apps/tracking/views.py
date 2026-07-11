from django.utils import timezone
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.trips.models import Trip
from apps.routes.models import Stop


class BusTimingsView(APIView):
    """
    GET /api/tracking/buses/
    Returns today's active schedule (no GPS) for the user's depot.
    Used by the Bus Timings & ETA passenger page.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = Trip.objects.filter(
            status__in=['SCHEDULED', 'ON_TIME', 'DELAYED', 'IN_PROGRESS'],
            departure_time__isnull=False,
        ).select_related('route', 'bus', 'depot')

        if not user.is_superuser:
            qs = qs.filter(depot=user.depot)

        qs = qs.order_by('departure_time')

        now_time = timezone.localtime().time()
        data = []
        for trip in qs:
            stops = list(Stop.objects.filter(route=trip.route).order_by('order'))
            total_minutes = sum(s.travel_minutes for s in stops)

            # Build frequency slots if applicable
            departure_slots = []
            if trip.departure_time:
                base_dt = datetime.combine(datetime.today(), trip.departure_time)
                if trip.frequency and trip.frequency > 0 and trip.arrival_time:
                    end_dt = datetime.combine(datetime.today(), trip.arrival_time)
                    current = base_dt
                    while current <= end_dt:
                        departure_slots.append(current.strftime('%H:%M'))
                        current += timedelta(minutes=trip.frequency)
                else:
                    departure_slots.append(base_dt.strftime('%H:%M'))

            # Compute effective departure (with delay)
            effective_dep = None
            if trip.departure_time:
                eff_dt = datetime.combine(datetime.today(), trip.departure_time) + timedelta(minutes=trip.delay_minutes)
                effective_dep = eff_dt.strftime('%H:%M')

            data.append({
                'trip_id': trip.id,
                'bus_number': trip.bus.bus_number,
                'route_number': trip.route.route_number,
                'route_name': trip.route.route_name,
                'source': trip.route.source,
                'destination': trip.route.destination,
                'fare': str(trip.route.fare),
                'departure_time': trip.departure_time.strftime('%H:%M') if trip.departure_time else None,
                'arrival_time': trip.arrival_time.strftime('%H:%M') if trip.arrival_time else None,
                'effective_departure': effective_dep,
                'frequency': trip.frequency,
                'departure_slots': departure_slots,
                'status': trip.status,
                'display_status': trip.display_status,
                'delay_minutes': trip.delay_minutes,
                'delay_reason': trip.delay_reason,
                'total_journey_minutes': total_minutes,
                'stop_count': len(stops),
                'available_seats': max(0, trip.bus.capacity - trip.tickets.filter(
                    status__in=['CONFIRMED', 'USED']
                ).count()),
                'capacity': trip.bus.capacity,
            })

        return Response(data)
