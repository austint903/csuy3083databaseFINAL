#!/usr/bin/env python3
"""Scrape specific NYU dining URLs and print JSON — no Supabase needed."""
import json, re
from datetime import date
from playwright.sync_api import sync_playwright, Response

TODAY = date.today().isoformat()
BASE  = "https://dineoncampus.com/NYUeats/whats-on-the-menu"

TARGETS = [
    ("nyu-eats-at-lipton",    "Lipton",             "breakfast"),
    ("dunkin",                "Dunkin'",             "every-day"),
    ("peet-s-coffee",         "Peet's Coffee",       "every-day"),
    ("starbucks",             "Starbucks",           "every-day"),
    ("u-hall-commons-cafe",   "U-Hall Commons Cafe", "supper"),
    ("crave-nyu",             "Crave NYU",           "lunch"),
    ("upstein",               "Upstein",             "everyday"),
    ("palladium",             "Palladium",           "supper"),
    ("jasper-kane-cafe",      "Jasper Kane Cafe",    "breakfast"),
    ("kosher-eatery",         "Kosher Eatery",       "lunch"),
]

def scrape(page, slug, meal):
    url = f"{BASE}/{slug}/{TODAY}/{meal}"
    captured = []

    def on_resp(r: Response):
        if "api.dineoncampus.com" in r.url:
            try: captured.append(r.json())
            except: pass

    page.on("response", on_resp)
    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
    except Exception:
        pass
    finally:
        page.remove_listener("response", on_resp)

    items = []
    for resp in captured:
        menu = resp.get("menu") or {}
        for period in menu.get("periods", []):
            for cat in period.get("categories", []):
                for item in cat.get("items", []):
                    name = (item.get("name") or "").strip()
                    if name:
                        items.append({"name": name, "category": cat.get("name", "")})

    if not items:
        for sel in ["[data-recipe-id]", ".rec-name", ".menu-item-name"]:
            try:
                for h in page.query_selector_all(sel):
                    t = (h.inner_text() or "").strip().split("\n")[0]
                    if t and len(t) > 2:
                        items.append({"name": t, "category": ""})
                if items: break
            except: pass

    return items

results = {}
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    for slug, name, meal in TARGETS:
        import sys; print(f"Scraping {name}...", file=sys.stderr, flush=True)
        items = scrape(page, slug, meal)
        if items:
            results[slug] = {"name": name, "meal": meal, "items": items}
        else:
            print(f"  (no items)", file=sys.stderr)
    browser.close()

print(json.dumps(results, indent=2))
