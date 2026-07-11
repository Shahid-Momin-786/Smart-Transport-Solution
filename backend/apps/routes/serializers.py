from rest_framework import serializers
from .models import Route, Stop


class StopSerializer(serializers.ModelSerializer):
    """Stop with schedule-based ETA fields."""
    class Meta:
        model = Stop
        fields = [
            'id', 'route', 'name', 'order',
            'latitude', 'longitude',
            'travel_minutes', 'distance_from_prev', 'arrival_offset',
        ]
        read_only_fields = ['route']


class RouteSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    stop_count = serializers.IntegerField(source='stops.count', read_only=True)
    total_journey_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_total_journey_minutes(self, obj):
        """Sum of travel_minutes across all stops (excluding the first stop)."""
        return sum(s.travel_minutes for s in obj.stops.all())


class RouteListSerializer(serializers.ModelSerializer):
    depot_name = serializers.CharField(source='depot.name', read_only=True)
    stop_count = serializers.IntegerField(source='stops.count', read_only=True)
    total_journey_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = [
            'id', 'route_name', 'route_number', 'source', 'destination',
            'distance', 'fare', 'depot', 'depot_name', 'is_active',
            'stop_count', 'total_journey_minutes',
        ]

    def get_total_journey_minutes(self, obj):
        return sum(s.travel_minutes for s in obj.stops.all())
