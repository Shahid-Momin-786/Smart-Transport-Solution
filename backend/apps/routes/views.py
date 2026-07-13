from datetime import datetime, timedelta, time as time_type
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Route, Stop
from .serializers import RouteSerializer, RouteListSerializer, StopSerializer


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


def _combine_time_with_offset(base_time: time_type, offset_minutes: int) -> datetime:
    """Return a datetime by combining today's date, a base time, and an offset in minutes."""
    today = timezone.localdate()
    base_dt = datetime.combine(today, base_time)
    return base_dt + timedelta(minutes=offset_minutes)


class RouteViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'depot']
    search_fields = ['route_name', 'route_number', 'source', 'destination']
    ordering_fields = ['route_number', 'source', 'destination', 'fare', 'created_at']
    ordering = ['route_number']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'stops', 'search', 'schedule', 'eta', 'next_bus', 'journey_planner']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == 'list':
            return RouteListSerializer
        return RouteSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Route.objects.prefetch_related('stops').all()
        # Passengers & unauthenticated: see all active routes across all depots
        # Admins (non-superuser): scoped to their own depot
        if user.is_authenticated and not user.is_superuser:
            role = getattr(user, 'role', 'PASSENGER')
            if role == 'ADMIN':
                qs = qs.filter(depot=user.depot)
            else:
                # PASSENGER, CONDUCTOR, DRIVER — see all active routes
                qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(depot=self.request.user.depot)
        else:
            serializer.save()

    # ── Existing stop list ───────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def stops(self, request, pk=None):
        """GET /api/routes/{id}/stops/ — ordered stops with travel times."""
        route = self.get_object()
        stops = Stop.objects.filter(route=route).order_by('order')
        serializer = StopSerializer(stops, many=True)
        return Response(serializer.data)

    # ── Route search (by number, source, or destination) ────────────────────

    @action(detail=False, methods=['get'])
    def search(self, request):
        """GET /api/routes/search/?q=139 — search by route number, source, or destination."""
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'results': [], 'count': 0})

        qs = self.get_queryset().filter(is_active=True)
        from django.db.models import Q
        results = qs.filter(
            Q(route_number__icontains=q) |
            Q(source__icontains=q) |
            Q(destination__icontains=q) |
            Q(route_name__icontains=q)
        ).distinct()

        serializer = RouteListSerializer(results, many=True)
        return Response({'results': serializer.data, 'count': results.count()})

    # ── Today's schedule for a route ─────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        """GET /api/routes/{id}/schedule/ — all trips (scheduled buses) for this route today."""
        route = self.get_object()
        from apps.trips.models import Trip
        from apps.trips.serializers import TripSerializer

        trips = Trip.objects.filter(
            route=route,
            status__in=['SCHEDULED', 'ON_TIME', 'DELAYED', 'IN_PROGRESS'],
        ).select_related('bus', 'depot').order_by('departure_time')

        # Annotate stops with cumulative ETA for each trip
        stops = list(Stop.objects.filter(route=route).order_by('order'))
        trip_data = []
        for trip in trips:
            serialized = TripSerializer(trip).data
            # Build stop timeline if departure_time is set
            if trip.departure_time:
                stop_timeline = _build_stop_timeline(stops, trip.departure_time, trip.delay_minutes)
                serialized['stop_timeline'] = stop_timeline
            trip_data.append(serialized)

        return Response({
            'route': RouteListSerializer(route).data,
            'trips': trip_data,
            'total_trips': len(trip_data),
        })

    # ── ETA calculation ───────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def eta(self, request, pk=None):
        """
        GET /api/routes/{id}/eta/?trip=<id>&boarding_stop=<stop_id>
        Returns the ETA for the bus to reach the specified boarding stop.
        Only calculated when a boarding stop is explicitly provided.
        """
        route = self.get_object()
        trip_id = request.query_params.get('trip')
        boarding_stop_id = request.query_params.get('boarding_stop')

        if not trip_id:
            return Response({'error': 'trip parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.trips.models import Trip
        try:
            trip = Trip.objects.get(id=trip_id, route=route)
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found for this route.'}, status=status.HTTP_404_NOT_FOUND)

        stops = list(Stop.objects.filter(route=route).order_by('order'))
        stop_timeline = _build_stop_timeline(stops, trip.departure_time, trip.delay_minutes)

        if not boarding_stop_id:
            # No boarding stop: return timetable only
            return Response({
                'route': RouteListSerializer(route).data,
                'trip': {
                    'id': trip.id,
                    'bus_number': trip.bus.bus_number,
                    'departure_time': trip.departure_time.strftime('%H:%M') if trip.departure_time else None,
                    'arrival_time': trip.arrival_time.strftime('%H:%M') if trip.arrival_time else None,
                    'status': trip.status,
                    'delay_minutes': trip.delay_minutes,
                    'delay_reason': trip.delay_reason,
                },
                'stop_timeline': stop_timeline,
                'eta': None,
                'message': 'Select a boarding stop to see your ETA.',
            })

        # Boarding stop selected: calculate ETA
        boarding_eta = None
        for entry in stop_timeline:
            if str(entry['stop_id']) == str(boarding_stop_id):
                boarding_eta = entry
                break

        if not boarding_eta:
            return Response({'error': 'Boarding stop not found on this route.'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate remaining minutes from now
        now = timezone.localtime()
        eta_time_str = boarding_eta['estimated_time']
        try:
            eta_hour, eta_min = map(int, eta_time_str.split(':'))
            eta_dt = now.replace(hour=eta_hour, minute=eta_min, second=0, microsecond=0)
            if eta_dt < now:
                eta_dt += timedelta(days=1)  # next day
            remaining_minutes = max(0, int((eta_dt - now).total_seconds() / 60))
        except Exception:
            remaining_minutes = None

        return Response({
            'route': RouteListSerializer(route).data,
            'trip': {
                'id': trip.id,
                'bus_number': trip.bus.bus_number,
                'departure_time': trip.departure_time.strftime('%H:%M') if trip.departure_time else None,
                'status': trip.status,
                'delay_minutes': trip.delay_minutes,
                'delay_reason': trip.delay_reason,
            },
            'boarding_stop': {
                'id': boarding_eta['stop_id'],
                'name': boarding_eta['stop_name'],
            },
            'eta': {
                'estimated_time': boarding_eta['estimated_time'],
                'remaining_minutes': remaining_minutes,
                'is_delayed': trip.delay_minutes > 0,
                'delay_minutes': trip.delay_minutes,
                'delay_reason': trip.delay_reason,
            },
        })

    # ── Next bus ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def next_bus(self, request, pk=None):
        """GET /api/routes/{id}/next-bus/ — next departure for this route."""
        route = self.get_object()
        from apps.trips.models import Trip

        now_time = timezone.localtime().time()
        trips = Trip.objects.filter(
            route=route,
            status__in=['SCHEDULED', 'ON_TIME', 'DELAYED', 'IN_PROGRESS'],
            departure_time__isnull=False,
        ).order_by('departure_time')

        # Find next trip after current time
        next_trip = None
        for trip in trips:
            effective_time = (
                datetime.combine(datetime.today(), trip.departure_time) +
                timedelta(minutes=trip.delay_minutes)
            ).time()
            if effective_time >= now_time:
                next_trip = trip
                break

        if not next_trip and trips.exists():
            next_trip = trips.first()  # wrap around to earliest

        if not next_trip:
            return Response({'next_bus': None, 'message': 'No scheduled buses for this route.'})

        from apps.trips.serializers import TripSerializer
        return Response({
            'next_bus': TripSerializer(next_trip).data,
            'departure_time': next_trip.departure_time.strftime('%H:%M') if next_trip.departure_time else None,
            'effective_departure': (
                datetime.combine(datetime.today(), next_trip.departure_time) +
                timedelta(minutes=next_trip.delay_minutes)
            ).strftime('%H:%M') if next_trip.departure_time else None,
        })

    # ── Journey planner ───────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def journey_planner(self, request):
        """
        GET /api/routes/journey-planner/?source=Swargate&destination=Katraj
        Returns routes matching the source/destination pair.
        """
        source = request.query_params.get('source', '').strip()
        destination = request.query_params.get('destination', '').strip()

        if not source or not destination:
            return Response({'error': 'Both source and destination are required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db.models import Q
        qs = self.get_queryset().filter(is_active=True)
        results = qs.filter(
            Q(source__icontains=source) | Q(stops__name__icontains=source)
        ).filter(
            Q(destination__icontains=destination) | Q(stops__name__icontains=destination)
        ).distinct()

        route_data = []
        for route in results:
            from apps.trips.models import Trip
            next_trip = Trip.objects.filter(
                route=route,
                status__in=['SCHEDULED', 'ON_TIME', 'DELAYED'],
                departure_time__isnull=False,
            ).order_by('departure_time').first()

            stops = Stop.objects.filter(route=route).order_by('order')
            total_minutes = sum(s.travel_minutes for s in stops)

            route_data.append({
                **RouteListSerializer(route).data,
                'total_journey_minutes': total_minutes,
                'next_departure': next_trip.departure_time.strftime('%H:%M') if next_trip and next_trip.departure_time else None,
                'next_trip_id': next_trip.id if next_trip else None,
                'next_trip_status': next_trip.status if next_trip else None,
                'next_trip_delay': next_trip.delay_minutes if next_trip else 0,
            })

        return Response({'results': route_data, 'count': len(route_data)})


# ── Helper ────────────────────────────────────────────────────────────────────

def _build_stop_timeline(stops, departure_time, delay_minutes=0):
    """
    Build a list of stops with their estimated arrival times.
    ETA = departure_time + cumulative travel_minutes + delay_minutes
    The first stop arrives at departure_time + delay_minutes.
    """
    if not departure_time:
        return []

    today = timezone.localdate()
    base_dt = datetime.combine(today, departure_time) + timedelta(minutes=delay_minutes)
    cumulative = 0
    timeline = []

    for stop in stops:
        arrival_dt = base_dt + timedelta(minutes=cumulative)
        timeline.append({
            'stop_id': stop.id,
            'stop_name': stop.name,
            'order': stop.order,
            'estimated_time': arrival_dt.strftime('%H:%M'),
            'travel_minutes_from_prev': stop.travel_minutes if stop.order > 1 else 0,
            'cumulative_minutes': cumulative,
            'latitude': float(stop.latitude) if stop.latitude else None,
            'longitude': float(stop.longitude) if stop.longitude else None,
        })
        cumulative += stop.travel_minutes

    return timeline


class StopViewSet(viewsets.ModelViewSet):
    serializer_class = StopSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Stop.objects.all()
        return Stop.objects.filter(route__depot=user.depot)
