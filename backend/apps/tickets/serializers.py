from rest_framework import serializers
from .models import Ticket


class TicketSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source='passenger.name', read_only=True)
    passenger_email = serializers.CharField(source='passenger.email', read_only=True)
    route_number = serializers.CharField(source='trip.route.route_number', read_only=True)
    route_name = serializers.CharField(source='trip.route.route_name', read_only=True)
    source = serializers.CharField(source='trip.route.source', read_only=True)
    destination = serializers.CharField(source='trip.route.destination', read_only=True)
    bus_number = serializers.CharField(source='trip.bus.bus_number', read_only=True)
    trip_start_time = serializers.DateTimeField(source='trip.start_time', read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    boarding_stop_name = serializers.CharField(source='boarding_stop.name', read_only=True)

    class Meta:
        model = Ticket
        fields = '__all__'
        read_only_fields = ['ticket_number', 'qr_code', 'booked_at', 'updated_at']


class BookTicketSerializer(serializers.Serializer):
    trip = serializers.IntegerField()
    seat_number = serializers.CharField(max_length=10)
    boarding_stop = serializers.IntegerField(required=False, allow_null=True)

    def validate_seat_number(self, value):
        return value.upper()


class VerifyQRSerializer(serializers.Serializer):
    ticket_number = serializers.CharField()
