from django.core.exceptions import ValidationError
from django.utils import timezone


def validate_not_future_date(value):
    if value > timezone.localdate():
        raise ValidationError("Maintenance date cannot be in the future.")
