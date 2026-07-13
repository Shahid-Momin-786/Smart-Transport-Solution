from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from apps.trips.models import Trip
from apps.routes.models import Stop
from .models import Ticket
from .serializers import TicketSerializer, BookTicketSerializer, VerifyQRSerializer


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'depot', 'passenger']
    search_fields = ['ticket_number', 'passenger__name', 'passenger__email']
    ordering_fields = ['booked_at', 'fare', 'status']
    ordering = ['-booked_at']

    def get_permissions(self):
        if self.action in ['book', 'my_tickets', 'retrieve']:
            return [permissions.IsAuthenticated()]
        if self.action in ['list', 'verify']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        qs = Ticket.objects.select_related('passenger', 'trip__route', 'trip__bus', 'depot').all()
        if user.is_superuser:
            return qs
        if user.role == 'ADMIN':
            return qs.filter(depot=user.depot)
        # Passengers see only their own tickets
        return qs.filter(passenger=user)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def book(self, request):
        serializer = BookTicketSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            trip = Trip.objects.get(id=data['trip'])
        except Trip.DoesNotExist:
            return Response({'error': 'Trip not found.'}, status=status.HTTP_404_NOT_FOUND)

        if trip.status not in ['SCHEDULED', 'IN_PROGRESS']:
            return Response({'error': 'Trip is not available for booking.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check seat availability
        booked = trip.tickets.filter(status__in=['CONFIRMED', 'USED']).count()
        if booked >= trip.bus.capacity:
            return Response({'error': 'No seats available.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check seat not already taken
        seat_taken = trip.tickets.filter(seat_number=data['seat_number'], status='CONFIRMED').exists()
        if seat_taken:
            return Response({'error': f"Seat {data['seat_number']} is already booked."}, status=status.HTTP_400_BAD_REQUEST)

        boarding_stop = None
        dropoff_stop = None
        calculated_fare = trip.route.fare

        if data.get('boarding_stop'):
            try:
                boarding_stop = Stop.objects.get(id=data['boarding_stop'], route=trip.route)
            except Stop.DoesNotExist:
                pass

        if data.get('dropoff_stop'):
            try:
                dropoff_stop = Stop.objects.get(id=data['dropoff_stop'], route=trip.route)
            except Stop.DoesNotExist:
                pass

        if boarding_stop and dropoff_stop:
            # Stage-based fare calculation (simple distance/stops logic)
            stops_count = abs(dropoff_stop.order - boarding_stop.order)
            calculated_fare = max(5, int(stops_count * 5)) # Example logic: min Rs 5, Rs 5 per stop

        ticket = Ticket.objects.create(
            passenger=request.user,
            trip=trip,
            depot=trip.depot,
            seat_number=data['seat_number'],
            boarding_stop=boarding_stop,
            fare=calculated_fare,
        )
        return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_tickets(self, request):
        tickets = Ticket.objects.filter(passenger=request.user).select_related(
            'trip__route', 'trip__bus', 'depot'
        )
        page = self.paginate_queryset(tickets)
        if page is not None:
            serializer = TicketSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def verify(self, request):
        serializer = VerifyQRSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            ticket = Ticket.objects.get(ticket_number=serializer.validated_data['ticket_number'])
            if ticket.status == 'CONFIRMED':
                ticket.status = 'USED'
                ticket.save()
                return Response({'valid': True, 'ticket': TicketSerializer(ticket).data})
            return Response({'valid': False, 'status': ticket.status, 'ticket': TicketSerializer(ticket).data})
        except Ticket.DoesNotExist:
            return Response({'valid': False, 'error': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status != 'CONFIRMED':
            return Response({'error': 'Only confirmed tickets can be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)
        ticket.status = 'CANCELLED'
        ticket.save()
        return Response(TicketSerializer(ticket).data)
