import io
import os
from threading import Thread

import requests
from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import get_template
from rest_framework.parsers import JSONParser

api_key = os.getenv("ABSTRACT_API_KEY") or ""

api_url = "https://emailvalidation.abstractapi.com/v1/?api_key=" + api_key + "&email="


class SendMailThread(Thread):
    def __init__(self, to_email: str, template: str, context_object: dict, subject: str = "FlashLearn"):
        self.to_email = to_email
        self.template = template
        self.context_object = context_object
        self.subject = subject
        Thread.__init__(self)

    def send_template_email(self):
        content = get_template(self.template).render(self.context_object)
        mail = EmailMessage(
            subject=self.subject,
            body=content,
            from_email=settings.EMAIL_HOST_USER,
            to=[self.to_email],
            reply_to=[settings.EMAIL_HOST_USER],
        )
        mail.content_subtype = "html"
        mail.send()

    def run(self):
        try:
            self.send_template_email()
        except Exception as e:
            print(e)


class MailService:
    @classmethod
    def send_template_mail(cls, to_email: str, template: str, context_object: dict, subject: str = "FlashLearn"):
        """Async (threaded) — use in Django views to avoid blocking the HTTP response."""
        SendMailThread(to_email, template, context_object, subject).start()

    @classmethod
    def send_template_mail_sync(cls, to_email: str, template: str, context_object: dict, subject: str = "FlashLearn"):
        """Synchronous — use inside RQ tasks; the worker IS the background process."""
        content = get_template(template).render(context_object)
        mail = EmailMessage(
            subject=subject,
            body=content,
            from_email=settings.EMAIL_HOST_USER,
            to=[to_email],
            reply_to=[settings.EMAIL_HOST_USER],
        )
        mail.content_subtype = "html"
        mail.send()

    @classmethod
    def validate_email(cls, email):
        response = requests.get(api_url + email, timeout=10)
        stream = io.BytesIO(response.content)
        data = JSONParser().parse(stream)
        return response.ok and data["deliverability"] == "DELIVERABLE"
