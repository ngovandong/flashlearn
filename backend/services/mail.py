# import threading
#
# from django.conf import settings
# from django.core.mail import EmailMessage, send_mail
# from django.utils.module_loading import import_string
#
#
# class APIEmailMessage(EmailMessage):
#     """
#     Customize EmailMessage class to get mail username/password
#     """
#
#     def __init__(self, **kwargs):
#         self.username = kwargs.pop("username", None)
#         self.password = kwargs.pop("password", None)
#         super().__init__(**kwargs)
#
#     def get_connection(self, backend=None, fail_silently=False, **kwds):
#         if not self.connection:
#             klass = import_string(backend or settings.EMAIL_BACKEND)
#             self.connection = klass(
#                 fail_silently=fail_silently,
#                 username=self.username,
#                 password=self.password,
#                 **kwds
#             )
#         return self.connection
#
#
# class EmailThread(threading.Thread):
#     def __init__(
#             self,
#             subject=None,
#             content=None,
#             email=None,
#             sender=None,
#             email_password=None,
#             from_email=None,
#             cc=None,
#             bcc=None,
#     ):
#         self.subject = subject
#         self.content = content
#         self.from_email = (from_email or settings.DEFAULT_FROM_EMAIL,)
#         self.sender = sender or settings.EMAIL_HOST_USER
#         self.mail_password = email_password or settings.EMAIL_HOST_PASSWORD
#         self.recipient_list = email
#         self.cc = cc
#         self.bcc = bcc
#         threading.Thread.__init__(self)
#
#     def run(self):
#         email_options = dict(
#             subject=self.subject,
#             body=self.content,
#             from_email=settings.DEFAULT_FROM_EMAIL,
#             to=self.recipient_list,
#             username=self.sender,
#             password=self.mail_password,
#             cc=self.cc,
#             bcc=self.bcc,
#         )
#         try:
#             msg = APIEmailMessage(**email_options)
#             msg.content_subtype = "html"
#             msg.send()
#         except Exception as e:
#             # TODO: Add a log right here
#             import logging
#             logger = logging.getLogger(__name__)
#             logger.error(f"Failed to send email: {str(e)}")
#
#
# class SendMail:
#     @staticmethod
#     def start(email_list, subject, content, cc=None, bcc=None):
#         EmailThread(
#             subject=subject, email=email_list, content=content, cc=cc, bcc=bcc
#         ).start()

from typing import Dict
from threading import Thread
import os
import requests
import io
from rest_framework.parsers import JSONParser

from django.core.mail import EmailMessage
from django.template.loader import get_template
from django.conf import settings

api_key = os.getenv('ABSTRACT_API_KEY')

api_url = 'https://emailvalidation.abstractapi.com/v1/?api_key=' + api_key + '&email='


class SendMailThread(Thread):
    def __init__(self, to_email: str, template: str, context_object: Dict):
        self.to_email = to_email
        self.template = template
        self.context_object = context_object
        Thread.__init__(self)

    def send_template_email(self):
        """
        Send email to customer with order details.
        """
        content = get_template(self.template).render(self.context_object)

        mail = EmailMessage(
            subject="Order confirmation",
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
    def send_template_mail(cls, to_email: str, template: str, context_object: Dict):
        SendMailThread(
            to_email, template, context_object
        ).start()

    @classmethod
    def validate_email(cls, email):
        response = requests.get(api_url + email)
        stream = io.BytesIO(response.content)
        data = JSONParser().parse(stream)
        return response.ok and data['deliverability'] == 'DELIVERABLE'
