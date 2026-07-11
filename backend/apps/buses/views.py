from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import Bus
from .serializers import BusSerializer


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )


class BusViewSet(viewsets.ModelViewSet):
    serializer_class = BusSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'depot']
    search_fields = ['bus_number', 'model']
    ordering_fields = ['bus_number', 'capacity', 'status', 'created_at']
    ordering = ['bus_number']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Bus.objects.all()
        return Bus.objects.filter(depot=user.depot)

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            serializer.save(depot=self.request.user.depot)
        else:
            serializer.save()
