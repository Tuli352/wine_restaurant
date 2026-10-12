"""
M-Pesa STK push (Safaricom Daraja) helper.

MPESA_MODE controls behaviour:
  mock        no network calls; payments succeed after a few seconds (default, for local testing only)
  sandbox     real calls to Daraja's sandbox
  production  real calls to Daraja's live API

All settings come from environment variables (or a .env file). See .env.example.
"""

import base64
import logging
import os
import re
import secrets
import time
from datetime import datetime

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv is optional
    pass

log = logging.getLogger("mpesa")

MODE = os.environ.get("MPESA_MODE", "mock").strip().lower()
BASE_URLS = {
    "sandbox": "https://sandbox.safaricom.co.ke",
    "production": "https://api.safaricom.co.ke",
}

CONSUMER_KEY = os.environ.get("MPESA_CONSUMER_KEY", "")
CONSUMER_SECRET = os.environ.get("MPESA_CONSUMER_SECRET", "")
SHORTCODE = os.environ.get("MPESA_SHORTCODE", "")
PASSKEY = os.environ.get("MPESA_PASSKEY", "")
# Paybill: CustomerPayBillOnline, PartyB = paybill number.
# Till number: CustomerBuyGoodsOnline, SHORTCODE = store number, PartyB = till number.
TXN_TYPE = os.environ.get("MPESA_TXN_TYPE", "CustomerPayBillOnline")
PARTY_B = os.environ.get("MPESA_PARTY_B") or SHORTCODE
CALLBACK_BASE = os.environ.get("MPESA_CALLBACK_BASE", "").rstrip("/")
CALLBACK_SECRET = os.environ.get("MPESA_CALLBACK_SECRET", "")


class MpesaError(Exception):
    """Raised with a message that is safe to show to the customer."""


def check_config():
    if MODE not in ("mock", "sandbox", "production"):
        raise RuntimeError("MPESA_MODE must be mock, sandbox or production (got %r)." % MODE)
    if MODE == "mock":
        return
    required = {
        "MPESA_CONSUMER_KEY": CONSUMER_KEY,
        "MPESA_CONSUMER_SECRET": CONSUMER_SECRET,
        "MPESA_SHORTCODE": SHORTCODE,
        "MPESA_PASSKEY": PASSKEY,
        "MPESA_CALLBACK_BASE": CALLBACK_BASE,
        "MPESA_CALLBACK_SECRET": CALLBACK_SECRET,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise RuntimeError("MPESA_MODE=%s needs these settings: %s" % (MODE, ", ".join(missing)))


check_config()


def normalize_phone(raw):
    """Return 2547XXXXXXXX / 2541XXXXXXXX, or None if the number is not a Kenyan mobile."""
    digits = re.sub(r"[\s\-()]", "", str(raw or ""))
    if digits.startswith("+"):
        digits = digits[1:]
    if re.fullmatch(r"0[17]\d{8}", digits):
        digits = "254" + digits[1:]
    elif re.fullmatch(r"[17]\d{8}", digits):
        digits = "254" + digits
    return digits if re.fullmatch(r"254[17]\d{8}", digits) else None


def callback_url():
    return "%s/api/mpesa/callback/%s" % (CALLBACK_BASE, CALLBACK_SECRET)


_token = {"value": None, "expires": 0.0}


def _access_token():
    if _token["value"] and time.time() < _token["expires"]:
        return _token["value"]
    try:
        r = requests.get(
            BASE_URLS[MODE] + "/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            auth=(CONSUMER_KEY, CONSUMER_SECRET),
            timeout=15,
        )
        r.raise_for_status()
        _token["value"] = r.json()["access_token"]
    except (requests.RequestException, KeyError, ValueError) as exc:
        log.error("Daraja auth failed: %s", exc)
        raise MpesaError("We could not reach M-Pesa. Please try again in a moment.") from exc
    _token["expires"] = time.time() + 3000  # tokens last 3599s
    return _token["value"]


def _post(path, body):
    token = _access_token()
    try:
        r = requests.post(
            BASE_URLS[MODE] + path,
            json=body,
            headers={"Authorization": "Bearer " + token},
            timeout=20,
        )
    except requests.RequestException as exc:
        log.error("Daraja request failed: %s", exc)
        raise MpesaError("We could not reach M-Pesa. Please try again in a moment.") from exc
    try:
        data = r.json()
    except ValueError:
        data = {}
    return r.status_code, data


def _password():
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    pw = base64.b64encode((SHORTCODE + PASSKEY + stamp).encode()).decode()
    return pw, stamp


def stk_push(phone, amount, reference):
    """Send the PIN prompt to the customer's phone. Returns {'checkout_id', 'merchant_id'}."""
    if MODE == "mock":
        return {"checkout_id": "mock-" + secrets.token_hex(6), "merchant_id": "mock"}

    pw, stamp = _password()
    status, data = _post(
        "/mpesa/stkpush/v1/processrequest",
        {
            "BusinessShortCode": SHORTCODE,
            "Password": pw,
            "Timestamp": stamp,
            "TransactionType": TXN_TYPE,
            "Amount": int(amount),
            "PartyA": phone,
            "PartyB": PARTY_B,
            "PhoneNumber": phone,
            "CallBackURL": callback_url(),
            "AccountReference": reference[:12],
            "TransactionDesc": "Oriel order",
        },
    )
    if status == 200 and str(data.get("ResponseCode")) == "0" and data.get("CheckoutRequestID"):
        return {"checkout_id": data["CheckoutRequestID"], "merchant_id": data.get("MerchantRequestID")}
    log.error("STK push rejected (%s): %s", status, data)
    raise MpesaError("M-Pesa could not send the prompt. Check the phone number and try again.")


def stk_query(checkout_id):
    """Ask Daraja for the result. Returns None while the payment is still being processed."""
    pw, stamp = _password()
    status, data = _post(
        "/mpesa/stkpushquery/v1/query",
        {"BusinessShortCode": SHORTCODE, "Password": pw, "Timestamp": stamp, "CheckoutRequestID": checkout_id},
    )
    if "ResultCode" not in data:  # e.g. 500.001.1001 "still being processed"
        return None
    code = str(data["ResultCode"])
    return {"success": code == "0", "code": code, "desc": data.get("ResultDesc", "")}


def parse_callback(payload):
    """Pull the useful fields out of Daraja's callback body. Returns None if it is malformed."""
    try:
        cb = payload["Body"]["stkCallback"]
        meta = {
            i.get("Name"): i.get("Value")
            for i in (cb.get("CallbackMetadata") or {}).get("Item", [])
            if isinstance(i, dict)
        }
        return {
            "checkout_id": cb["CheckoutRequestID"],
            "code": str(cb["ResultCode"]),
            "desc": cb.get("ResultDesc", ""),
            "receipt": meta.get("MpesaReceiptNumber"),
        }
    except (KeyError, TypeError, AttributeError):
        return None


FRIENDLY = {
    "1": "Your M-Pesa balance is too low for this order.",
    "1032": "You cancelled the payment request.",
    "1037": "The request timed out before a PIN was entered. Please try again.",
    "2001": "The M-Pesa PIN was wrong. Please try again.",
}


def friendly_error(code, desc=""):
    return FRIENDLY.get(str(code)) or desc or "The payment did not go through. Please try again."
