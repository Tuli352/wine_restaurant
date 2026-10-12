"""Content for the Oriel Wine Room site. Edit this file to change wines and menu items.

All prices are whole Kenya shillings (KES), because M-Pesa only accepts whole KES amounts.
"""

WINE_TYPES = [
    ("all", "All"),
    ("red", "Red"),
    ("white", "White"),
    ("rose", "Rose"),
    ("sparkling", "Sparkling"),
]

WINES = [
    {"id": 1, "name": "Pinot Noir Reserve", "type": "red", "region": "Burgundy, France", "year": 2019,
     "price": 8050, "featured": True,
     "notes": "Red cherry, forest floor and a long, silky finish.",
     "pairing": "Roast duck, mushroom risotto"},
    {"id": 2, "name": "Cabernet Sauvignon", "type": "red", "region": "Napa Valley, USA", "year": 2018,
     "price": 10150, "featured": False,
     "notes": "Blackcurrant, cedar and firm, polished tannins.",
     "pairing": "Aged ribeye, lamb chops"},
    {"id": 3, "name": "Chianti Classico", "type": "red", "region": "Tuscany, Italy", "year": 2020,
     "price": 6250, "featured": False,
     "notes": "Sour cherry, dried herbs and bright acidity.",
     "pairing": "Tomato pasta, grilled sausages"},
    {"id": 4, "name": "Chablis Premier Cru", "type": "white", "region": "Burgundy, France", "year": 2021,
     "price": 8600, "featured": True,
     "notes": "Green apple, oyster shell and a clean mineral edge.",
     "pairing": "Oysters, seared scallops"},
    {"id": 5, "name": "Sauvignon Blanc", "type": "white", "region": "Marlborough, New Zealand", "year": 2022,
     "price": 4950, "featured": False,
     "notes": "Passion fruit, cut grass and lively citrus.",
     "pairing": "Goat cheese salad, grilled prawns"},
    {"id": 6, "name": "Dry Riesling", "type": "white", "region": "Mosel, Germany", "year": 2021,
     "price": 5700, "featured": False,
     "notes": "Lime zest, white peach and slate minerality.",
     "pairing": "Spicy noodles, smoked trout"},
    {"id": 7, "name": "Provence Rose", "type": "rose", "region": "Provence, France", "year": 2022,
     "price": 5200, "featured": False,
     "notes": "Wild strawberry, melon and a pale, dry finish.",
     "pairing": "Nicoise salad, grilled fish"},
    {"id": 8, "name": "Brut Champagne", "type": "sparkling", "region": "Champagne, France", "year": 2015,
     "price": 15600, "featured": True,
     "notes": "Brioche, lemon curd and fine, persistent bubbles.",
     "pairing": "Fried chicken, soft cheeses"},
    {"id": 9, "name": "Franciacorta Brut", "type": "sparkling", "region": "Lombardy, Italy", "year": 2018,
     "price": 9100, "featured": False,
     "notes": "Almond, pear and a creamy mousse.",
     "pairing": "Risotto, shellfish"},
]

# "wine" is the id of the bottle we suggest with the dish.
MENU = [
    {"section": "To start", "items": [
        {"name": "Oysters, shallot vinegar", "desc": "Six oysters on ice with lemon.", "price": 2750, "wine": 4},
        {"name": "Burrata and roast tomato", "desc": "Basil oil, grilled sourdough.", "price": 1800, "wine": 7},
        {"name": "Chicken liver parfait", "desc": "Fig chutney, toasted brioche.", "price": 1700, "wine": 6},
    ]},
    {"section": "Mains", "items": [
        {"name": "Roast duck breast", "desc": "Cherry jus, celeriac puree, wilted greens.", "price": 4400, "wine": 1},
        {"name": "Wild mushroom risotto", "desc": "Aged parmesan, thyme, truffle butter.", "price": 3400, "wine": 9},
        {"name": "Dry-aged ribeye", "desc": "Bone marrow butter, hand-cut chips.", "price": 6000, "wine": 2},
        {"name": "Seared sea bass", "desc": "Fennel, saffron potatoes, salsa verde.", "price": 4150, "wine": 5},
    ]},
    {"section": "To finish", "items": [
        {"name": "Dark chocolate pot", "desc": "Sea salt, olive oil, crisp biscuit.", "price": 1450, "wine": 3},
        {"name": "Cheese plate", "desc": "Three cheeses, quince paste, oatcakes.", "price": 2350, "wine": 8},
    ]},
]

WINES_BY_ID = {w["id"]: w for w in WINES}


# Everything that can be bought, keyed "w<id>" for wines and "m<n>" for dishes.
# The server prices every order from this table, never from what the browser sends.
CATALOG = {}
for _w in WINES:
    CATALOG["w%d" % _w["id"]] = {"name": "%s %d" % (_w["name"], _w["year"]), "price": _w["price"], "kind": "Bottle"}
_n = 0
for _group in MENU:
    for _item in _group["items"]:
        _n += 1
        _item["id"] = _n
        CATALOG["m%d" % _n] = {"name": _item["name"], "price": _item["price"], "kind": "Dish"}
