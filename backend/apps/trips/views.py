from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import Trip
from .serializers import TripSerializer


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'depot', 'route', 'bus']
    search_fields = ['route__route_number', 'bus__bus_number']
    ordering_fields = ['departure_time', 'status', 'created_at']
    ordering = ['departure_time']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'today']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        qs = Trip.objects.select_related('route', 'bus', 'depot').all()
        if user.is_authenticated and user.role == 'ADMIN' and not user.is_superuser:
            qs = qs.filter(depot=user.depot)
        return qs

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(depot=self.request.user.depot)
        else:
            serializer.save()

    # ── Status actions ────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        trip = self.get_object()
        if trip.status not in ['SCHEDULED', 'ON_TIME', 'DELAYED']:
            return Response({'error': 'Trip cannot be started in its current status.'}, status=status.HTTP_400_BAD_REQUEST)
        trip.status = 'IN_PROGRESS'
        trip.actual_start = timezone.now()
        trip.save()
        return Response(TripSerializer(trip).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        trip = self.get_object()
        if trip.status not in ['IN_PROGRESS', 'ON_TIME', 'DELAYED']:
            return Response({'error': 'Trip is not in progress.'}, status=status.HTTP_400_BAD_REQUEST)
        trip.status = 'COMPLETED'
        trip.actual_end = timezone.now()
        trip.save()
        return Response(TripSerializer(trip).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        trip = self.get_object()
        trip.status = 'CANCELLED'
        trip.save()
        return Response(TripSerializer(trip).data)

    # ── Delay management ──────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def update_delay(self, request, pk=None):
        """
        POST /api/trips/{id}/update-delay/
        Body: { "delay_minutes": 5, "delay_reason": "Traffic" }
        Automatically sets status to DELAYED if delay > 0, ON_TIME if 0.
        """
        trip = self.get_object()
        delay_minutes = request.data.get('delay_minutes', 0)
        delay_reason = request.data.get('delay_reason', '')

        try:
            delay_minutes = int(delay_minutes)
        except (ValueError, TypeError):
            return Response({'error': 'delay_minutes must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        trip.delay_minutes = delay_minutes
        trip.delay_reason = delay_reason
        if delay_minutes > 0:
            trip.status = 'DELAYED'
        elif trip.status == 'DELAYED':
            trip.status = 'ON_TIME'
        trip.save()
        return Response(TripSerializer(trip).data)

    # ── Today's schedule ──────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def today(self, request):
        """GET /api/trips/today/ — all active trips for today (for passenger view)."""
        qs = self.get_queryset().filter(
            status__in=['SCHEDULED', 'ON_TIME', 'DELAYED', 'IN_PROGRESS'],
            departure_time__isnull=False,
        ).order_by('departure_time')
        serializer = TripSerializer(qs, many=True)
        return Response(serializer.data)
