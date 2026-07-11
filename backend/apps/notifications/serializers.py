from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class CreateNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    user = serializers.UUIDField(required=False, allow_null=True)
    broadcast = serializers.BooleanField(default=False)
