from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from .models import Notification
from .serializers import NotificationSerializer, CreateNotificationSerializer

User = get_user_model()


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_read', 'depot']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'mark_read', 'mark_all_read', 'unread_count']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Notification.objects.all()
        if user.role == 'ADMIN':
            return Notification.objects.filter(depot=user.depot)
        # Passengers see their own + broadcasts (user=None)
        from django.db.models import Q
        return Notification.objects.filter(depot=user.depot).filter(
            Q(user=user) | Q(user__isnull=True)
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get('broadcast'):
            # Create one notification per passenger
            passengers = User.objects.filter(depot=request.user.depot, role='PASSENGER', is_active=True)
            notifications = [
                Notification(
                    title=data['title'],
                    message=data['message'],
                    user=p,
                    depot=request.user.depot,
                )
                for p in passengers
            ]
            Notification.objects.bulk_create(notifications)
            return Response({'detail': f'Broadcast sent to {len(notifications)} passengers.'}, status=status.HTTP_201_CREATED)

        target_user = None
        if data.get('user'):
            try:
                target_user = User.objects.get(id=data['user'], depot=request.user.depot)
            except User.DoesNotExist:
                return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification = Notification.objects.create(
            title=data['title'],
            message=data['message'],
            user=target_user,
            depot=request.user.depot,
        )
        return Response(NotificationSerializer(notification).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'detail': 'All notifications marked as read.'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
