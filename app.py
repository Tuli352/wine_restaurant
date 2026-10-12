"""
Oriel Wine Room - multi-page restaurant & wine website (Flask) with cart and M-Pesa STK push.

Run:
    pip install -r requirements.txt
    python app.py
Open http://127.0.0.1:5000
"""

import json
import re
import secrets
import threading
import time
from datetime import date, datetime
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request

import mpesa  # loads .env on import
from data import CATALOG, MENU, WINE_TYPES, WINES, WINES_BY_ID

app = Flask(__name__)

RESERVATIONS_FILE = Path(__file__).with_name("reservations.json")
ORDERS_FILE = Path(__file__).with_name("orders.json")
_orders_lock = threading.Lock()

MAX_QTY = 20
MOCK_DELAY = 6  # seconds before a mock payment resolves

RESTAURANT = {
    "name": "Oriel Wine Room",
    "address": "14 Cellar Lane",
    "hours": "Tuesday to Sunday, 17:00 until late",
    "phone": "+1 555 0142",
    "email": "hello@orielwineroom.example",
}


@app.context_processor
def inject_globals():
    return {
        "restaurant": RESTAURANT,
        "current_year": date.today().year,
        "catalog": CATALOG,
        "mpesa_mode": mpesa.MODE,
    }


@app.template_filter("kes")
def kes(value):
    return f"KES {int(value):,}"


# ---------------------------------------------------------------- pages

@app.get("/")
def home():
    featured = [w for w in WINES if w["featured"]]
    return render_template("home.html", featured=featured)


@app.get("/wines")
def wines():
    return render_template("wines.html", wines=WINES, types=WINE_TYPES)


@app.get("/menu")
def menu():
    return render_template("menu.html", menu=MENU, wines_by_id=WINES_BY_ID)


@app.get("/about")
def about():
    return render_template("about.html")


@app.get("/cart")
def cart():
    return render_template("cart.html")


@app.get("/reserve")
def reserve():
    return render_template("reserve.html", today=date.today().isoformat())


# ---------------------------------------------------------------- reservations

@app.post("/api/reserve")
def api_reserve():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    day = str(data.get("date", "")).strip()
    time_ = str(data.get("time", "")).strip()

    try:
        guests = int(data.get("guests", 0))
    except (TypeError, ValueError):
        guests = 0

    if not name:
        return jsonify(message="Enter your full name."), 400
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify(message="Enter a valid email address."), 400
    try:
        if datetime.strptime(day, "%Y-%m-%d").date() < date.today():
            return jsonify(message="Choose a date today or later."), 400
    except ValueError:
        return jsonify(message="Choose a date for your visit."), 400
    if not 1 <= guests <= 10:
        return jsonify(message="We seat 1 to 10 guests online. Call us for larger groups."), 400

    bookings = json.loads(RESERVATIONS_FILE.read_text()) if RESERVATIONS_FILE.exists() else []
    bookings.append({"name": name, "email": email, "date": day, "time": time_, "guests": guests})
    RESERVATIONS_FILE.write_text(json.dumps(bookings, indent=2))

    first = name.split()[0]
    return jsonify(message=f"Table reserved for {guests} on {day} at {time_}. See you then, {first}.")


# ---------------------------------------------------------------- orders & payment

def _load_orders():
    return json.loads(ORDERS_FILE.read_text()) if ORDERS_FILE.exists() else {}


def _save_orders(orders):
    ORDERS_FILE.write_text(json.dumps(orders, indent=2))


def build_items(raw):
    """Turn the browser's [{key, qty}] list into priced lines. Prices always come from CATALOG."""
    if not isinstance(raw, list) or not raw:
        return None, 0
    merged = {}
    for entry in raw:
        if not isinstance(entry, dict):
            return None, 0
        key = str(entry.get("key", ""))
        try:
            qty = int(entry.get("qty", 0))
        except (TypeError, ValueError):
            return None, 0
        if key not in CATALOG or not 1 <= qty <= MAX_QTY:
            return None, 0
        merged[key] = min(merged.get(key, 0) + qty, MAX_QTY)
    items = [
        {"key": k, "name": CATALOG[k]["name"], "price": CATALOG[k]["price"], "qty": q}
        for k, q in merged.items()
    ]
    return items, sum(i["price"] * i["qty"] for i in items)


def settle(order, success, code, desc, receipt=None):
    """Record the final result of a payment. Only a pending order can change."""
    if order["status"] != "pending":
        return False
    if success:
        order.update(status="paid", receipt=receipt, message="Payment received. Thank you!")
    else:
        status = "cancelled" if str(code) == "1032" else "failed"
        order.update(status=status, message=mpesa.friendly_error(code, desc))
    order["result_code"] = str(code)
    return True


def refresh_order(order):
    """Resolve a pending order without waiting for the callback. Returns True if it changed."""
    if order["status"] != "pending":
        return False
    now = time.time()
    age = now - order["created"]

    if mpesa.MODE == "mock":
        if age < MOCK_DELAY:
            return False
        if order["phone"].endswith("0000"):  # test number: simulates a cancelled prompt
            return settle(order, False, "1032", "Request cancelled by user")
        return settle(order, True, "0", "OK", "MOCK" + secrets.token_hex(4).upper())

    # Live: the callback is the primary signal. If it has not arrived (for example the callback
    # URL is unreachable), ask Daraja directly, at most once every 8 seconds.
    if age >= 20 and now - order.get("last_query", 0) >= 8:
        order["last_query"] = now
        try:
            result = mpesa.stk_query(order["checkout_id"])
        except mpesa.MpesaError:
            return True
        if result:
            # A paid query result has no receipt number; the callback adds it if it arrives.
            settle(order, result["success"], result["code"], result["desc"], receipt=None)
    return True


@app.post("/api/checkout")
def api_checkout():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    note = str(data.get("note", "")).strip()[:200]
    phone = mpesa.normalize_phone(data.get("phone"))
    items, total = build_items(data.get("items"))

    if not name:
        return jsonify(message="Enter your full name."), 400
    if not phone:
        return jsonify(message="Enter a Safaricom number like 0712 345 678."), 400
    if not items:
        return jsonify(message="Your cart is empty or has an item we do not recognise."), 400

    order_id = secrets.token_urlsafe(6)
    try:
        push = mpesa.stk_push(phone, total, order_id)
    except mpesa.MpesaError as exc:
        return jsonify(message=str(exc)), 502

    order = {
        "id": order_id,
        "name": name,
        "phone": phone,
        "note": note,
        "items": items,
        "total": total,
        "status": "pending",
        "message": "Waiting for you to enter your M-Pesa PIN.",
        "checkout_id": push["checkout_id"],
        "receipt": None,
        "created": time.time(),
    }
    with _orders_lock:
        orders = _load_orders()
        orders[order_id] = order
        _save_orders(orders)

    return jsonify(order_id=order_id, message=f"Check your phone and enter your M-Pesa PIN to pay KES {total:,}.")


@app.get("/api/order/<order_id>")
def api_order(order_id):
    with _orders_lock:
        orders = _load_orders()
        order = orders.get(order_id)
        if not order:
            return jsonify(message="Order not found."), 404
        if refresh_order(order):
            _save_orders(orders)
    return jsonify(status=order["status"], message=order["message"], receipt=order.get("receipt"), order_id=order["id"])


@app.post("/api/mpesa/callback/<token>")
def mpesa_callback(token):
    # The secret in the URL stops strangers from posting fake "paid" results.
    expected = (mpesa.CALLBACK_SECRET or "").encode()
    if not expected or not secrets.compare_digest(token.encode(), expected):
        abort(404)
    result = mpesa.parse_callback(request.get_json(silent=True))
    if result:
        with _orders_lock:
            orders = _load_orders()
            for order in orders.values():
                if order.get("checkout_id") == result["checkout_id"]:
                    if order["status"] == "paid" and result["receipt"] and not order.get("receipt"):
                        order["receipt"] = result["receipt"]  # fill in a receipt the query path missed
                    else:
                        settle(order, result["code"] == "0", result["code"], result["desc"], result["receipt"])
                    _save_orders(orders)
                    break
    return jsonify(ResultCode=0, ResultDesc="Accepted")


@app.errorhandler(404)
def not_found(_):
    return render_template("404.html"), 404


if __name__ == "__main__":
    print(f" * M-Pesa mode: {mpesa.MODE}" + (" (no real payments are taken)" if mpesa.MODE == "mock" else ""))
    app.run(debug=True)
