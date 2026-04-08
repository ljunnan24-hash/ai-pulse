import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr

from app.config import get_settings

logger = logging.getLogger("aipulse.mail")


def _parse_from_header(from_header: str) -> tuple[str, str]:
    name, addr = parseaddr(from_header)
    if not addr:
        return "", from_header.strip()
    return name or "", addr


def send_email(to_addr: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password:
        raise RuntimeError("SMTP credentials not configured (smtp_user / smtp_password).")

    name, from_addr = _parse_from_header(settings.mail_from)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((name, from_addr)) if name else from_addr
    msg["To"] = to_addr

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    logger.info("sending email: to=%s subject=%s", to_addr, subject)
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=60) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to_addr], msg.as_string())
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=60) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to_addr], msg.as_string())
    logger.info("email sent: to=%s subject=%s", to_addr, subject)
