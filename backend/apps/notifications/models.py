from django.db import models


class Notification(models.Model):
    title = models.CharField(max_length=200)
    message = models.TextField()
    user = models.ForeignKey(
        'authentication.User', on_delete=models.CASCADE,
        related_name='notifications', null=True, blank=True,
        help_text='Null means broadcast to all depot users'
    )
    depot = models.ForeignKey('depots.Depot', on_delete=models.CASCADE, related_name='notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        target = self.user.name if self.user else 'All'
        return f"{self.title} → {target}"
