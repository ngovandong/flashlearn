import ssl

import certifi
from django.core.mail.backends.smtp import EmailBackend as BaseEmailBackend
from django.core.mail.utils import DNS_NAME


class EmailBackend(BaseEmailBackend):
    """SMTP backend that uses certifi's CA bundle.

    Needed on macOS/environments where Python's ssl module doesn't find
    the system CA store (common with Python.org or uv-managed Pythons).
    """

    def open(self):
        if self.connection:
            return False

        ssl_context = ssl.create_default_context(cafile=certifi.where())
        connection_params = {"local_hostname": DNS_NAME.get_fqdn()}
        if self.timeout is not None:
            connection_params["timeout"] = self.timeout
        if self.use_ssl:
            connection_params["context"] = ssl_context

        try:
            self.connection = self.connection_class(self.host, self.port, **connection_params)
            if not self.use_ssl and self.use_tls:
                self.connection.ehlo()
                self.connection.starttls(context=ssl_context)
                self.connection.ehlo()
            if self.username and self.password:
                self.connection.login(self.username, self.password)
            return True
        except OSError:
            if not self.fail_silently:
                raise
