import math
from django.utils import timezone
from datetime import datetime, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.trips.models import Trip
from apps.routes.models import Stop


# ── Pune city center fallback GPS ─────────────────────────────────────────────
PUNE_CENTER = (18.5204, 73.8567)


def _lerp(a, b, t):
    return a + (b - a) * t


def _simulate_position(stops, departure_time, delay_minutes=0):
    """
    Simulate the current GPS position of a bus based on:
    - Current time vs scheduled departure_time
    - Stop GPS coordinates (linear interpolation between stops)
    Returns (lat, lng, current_stop_name, next_stop_name, progress_pct)
    """
    if not departure_time or not stops:
        return PUNE_CENTER[0], PUNE_CENTER[1], None, None, 0

    now = timezone.localtime()
    base_dt = datetime.combine(now.date(), departure_time) + timedelta(minutes=delay_minutes)
    elapsed_minutes = (now - now.replace(
        hour=base_dt.hour, minute=base_dt.minute, second=0, microsecond=0
    )).total_seconds() / 60

    # If not started yet, position at source stop
    if elapsed_minutes < 0:
        src = stops[0]
        return (
            float(src.latitude) if src.latitude else PUNE_CENTER[0],
            float(src.longitude) if src.longitude else PUNE_CENTER[1],
            src.name, stops[1].name if len(stops) > 1 else None, 0
        )

    # Find which segment the bus is currently in
    cumulative = 0
    for i in range(len(stops) - 1):
        seg_minutes = stops[i + 1].travel_minutes or 3
        if elapsed_minutes <= cumulative + seg_minutes:
            # Bus is between stops[i] and stops[i+1]
            seg_progress = (elapsed_minutes - cumulative) / max(seg_minutes, 1)
            seg_progress = max(0.0, min(1.0, seg_progress))

            lat_a = float(stops[i].latitude) if stops[i].latitude else PUNE_CENTER[0]
            lng_a = float(stops[i].longitude) if stops[i].longitude else PUNE_CENTER[1]
            lat_b = float(stops[i + 1].latitude) if stops[i + 1].latitude else PUNE_CENTER[0]
            lng_b = float(stops[i + 1].longitude) if stops[i + 1].longitude else PUNE_CENTER[1]

            lat = _lerp(lat_a, lat_b, seg_progress)
            lng = _lerp(lng_a, lng_b, seg_progress)

            total_minutes = sum(s.travel_minutes for s in stops)
            total_elapsed = cumulative + (elapsed_minutes - cumulative)
            progress_pct = min(100, int(total_elapsed / max(total_minutes, 1) * 100))

            return (
                round(lat, 6), round(lng, 6),
                stops[i].name,
                stops[i + 1].name,
                progress_pct,
            )
        cumulative += seg_minutes

    # Bus has completed journey — position at destination
    dst = stops[-1]
    return (
        float(dst.latitude) if dst.latitude else PUNE_CENTER[0],
        float(dst.longitude) if dst.longitude else PUNE_CENTER[1],
        dst.name, None, 100
    )


class BusTimingsView(APIView):
    """
    GET /api/tracking/buses/
    Returns today's active schedule with simulated GPS position for each trip.
    Used by the Bus Timings & Tracking passenger pages.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = Trip.objects.filter(
            status__in=['SCHEDULED', 'ON_TIME', 'DELAYED', 'IN_PROGRESS'],
            departure_time__isnull=False,
        ).select_related('route', 'bus', 'depot')

        if user.is_authenticated and not user.is_superuser:
            role = getattr(user, 'role', 'PASSENGER')
            if role == 'ADMIN':
                qs = qs.filter(depot=user.depot)

        qs = qs.order_by('departure_time')

        now_time = timezone.localtime().time()
        data = []

        for trip in qs:
            stops = list(Stop.objects.filter(route=trip.route).order_by('order'))
            total_minutes = sum(s.travel_minutes for s in stops)

            # ── Simulated GPS position ────────────────────────────────────────
            sim_lat, sim_lng, cur_stop, next_stop, progress_pct = _simulate_position(
                stops, trip.departure_time, trip.delay_minutes
            )

            # ── Frequency-based departure slots ───────────────────────────────
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

            # ── Effective departure with delay ────────────────────────────────
            effective_dep = None
            if trip.departure_time:
                eff_dt = datetime.combine(datetime.today(), trip.departure_time) + timedelta(minutes=trip.delay_minutes)
                effective_dep = eff_dt.strftime('%H:%M')

            # ── Available seats ───────────────────────────────────────────────
            booked = trip.tickets.filter(status__in=['CONFIRMED', 'USED']).count()
            available_seats = max(0, trip.bus.capacity - booked)

            # ── ETA to next stop ──────────────────────────────────────────────
            eta_minutes = None
            if next_stop and stops:
                for i, s in enumerate(stops):
                    if s.name == next_stop and i > 0:
                        eta_minutes = stops[i].travel_minutes
                        break

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
                'available_seats': available_seats,
                'capacity': trip.bus.capacity,
                'passenger_count': booked,
                # ── Simulated live position ───────────────────────────────────
                'latitude': sim_lat,
                'longitude': sim_lng,
                'current_stop': cur_stop,
                'next_stop': next_stop,
                'journey_progress_pct': progress_pct,
                'eta_to_next_stop_minutes': eta_minutes,
                'driver_name': 'On Duty',
            })

        return Response(data)
