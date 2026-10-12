# Oriel Wine Room

A multi-page restaurant and wine website built with Flask.

## Pages
- `/` Home with the full-screen video cover
- `/wines` Wine list with filters and tasting notes
- `/menu` Food menu with a wine suggestion for each dish
- `/about` Our story and visiting information
- `/reserve` Table reservation form (bookings are saved to `reservations.json`)
- `/cart` Cart and M-Pesa checkout (orders are saved to `orders.json`)

## Run
```bash
pip install -r requirements.txt
python app.py
```
Open http://127.0.0.1:5000

## Folder structure
```
wine_restaurant/
├── app.py              routes and reservation API
├── mpesa.py            M-Pesa Daraja STK push helper
├── data.py             wines and menu items, prices in KES (edit these)
├── .env.example        M-Pesa settings template
├── requirements.txt
├── templates/          base, home, wines, menu, about, reserve, cart, 404
└── static/
    ├── css/style.css
    ├── js/main.js
    ├── js/cart.js
    ├── img/hero-poster.jpg
    └── video/hero.mp4  cover video (silent, cropped, web-optimised)
```

## Customise
- Change the restaurant name, address and hours in the `RESTAURANT` dictionary in `app.py`.
- Replace `static/video/hero.mp4` to change the cover video. Keep it short, muted and under about 3 MB.
- Make sure you have the right to use any video you publish.

## Cart and M-Pesa payments
Guests add bottles and dishes to a cart (kept in their browser), then pay on `/cart` with an M-Pesa STK push.
The server prices every order from `data.py`, so prices sent by the browser are ignored.

Flow: checkout sends the prompt to the guest's phone, the page polls `/api/order/<id>`, and Safaricom's
callback (`/api/mpesa/callback/<secret>`) marks the order paid. If the callback does not arrive within 20 seconds,
the server asks Daraja for the result directly.

1. Copy `.env.example` to `.env`.
2. **Try it first in mock mode** (the default): no keys needed, payment succeeds after about 6 seconds.
   A phone number ending in `0000` simulates a cancelled prompt.
3. **Sandbox**: create an app on the Safaricom Daraja portal, set `MPESA_MODE=sandbox`, fill in the keys, and expose
   your app over HTTPS (for example `ngrok http 5000`) as `MPESA_CALLBACK_BASE`.
4. **Production**: use your own paybill/till credentials, `MPESA_MODE=production`, and run behind a real
   WSGI server (gunicorn) with `debug` off. Never run mock mode in production.

Prices are in whole Kenya shillings. Orders are stored in `orders.json`; swap in a database before real traffic.
