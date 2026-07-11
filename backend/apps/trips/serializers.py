from rest_framework import serializers
from .models import Trip


class TripSerializer(serializers.ModelSerializer):
    route_number = serializers.CharField(source='route.route_number', read_only=True)
    route_name = serializers.CharField(source='route.route_name', read_only=True)
    source = serializers.CharField(source='route.source', read_only=True)
    destination = serializers.CharField(source='route.destination', read_only=True)
    fare = serializers.DecimalField(source='route.fare', max_digits=8, decimal_places=2, read_only=True)
    bus_number = serializers.CharField(source='bus.bus_number', read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    available_seats = serializers.SerializerMethodField()
    departure_display = serializers.SerializerMethodField()
    arrival_display = serializers.SerializerMethodField()
    effective_departure_display = serializers.SerializerMethodField()
    display_status = serializers.CharField(read_only=True)
    is_delayed = serializers.BooleanField(read_only=True)
    stop_count = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'route', 'bus', 'depot',
            'route_number', 'route_name', 'source', 'destination', 'fare',
            'bus_number', 'depot_name',
            'departure_time', 'arrival_time', 'frequency',
            'avg_stop_minutes', 'delay_minutes', 'delay_reason',
            'status', 'display_status', 'is_delayed',
            'departure_display', 'arrival_display', 'effective_departure_display',
            'passenger_count', 'available_seats', 'stop_count',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_available_seats(self, obj):
        booked = obj.tickets.filter(status__in=['CONFIRMED', 'USED']).count()
        return max(0, obj.bus.capacity - booked)

    def get_departure_display(self, obj):
        return obj.departure_time.strftime('%H:%M') if obj.departure_time else None

    def get_arrival_display(self, obj):
        return obj.arrival_time.strftime('%H:%M') if obj.arrival_time else None

    def get_effective_departure_display(self, obj):
        dep = obj.effective_departure
        return dep.strftime('%H:%M') if dep else None

    def get_stop_count(self, obj):
        return obj.route.stops.count()
