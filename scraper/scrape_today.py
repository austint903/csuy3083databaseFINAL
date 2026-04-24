#!/usr/bin/env python3
"""One-shot scrape of specific NYU dining URLs for today."""
import json, os, re
from datetime import date
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Response
from supabase import create_client

load_dotenv()

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

    # Try API intercept first
    items = []
    for resp in captured:
        menu = resp.get("menu") or {}
        for period in menu.get("periods", []):
            for cat in period.get("categories", []):
                for item in cat.get("items", []):
                    name = (item.get("name") or "").strip()
                    if name:
                        items.append({"name": name, "category": cat.get("name", "")})

    # DOM fallback
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


def main():
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for slug, name, meal in TARGETS:
            print(f"  {name} / {meal} ...", end=" ", flush=True)
            items = scrape(page, slug, meal)
            if not items:
                print("no items — skipping")
                continue
            db.table("dining_menu").upsert({
                "hall_name":   name,
                "hall_slug":   slug,
                "date":        TODAY,
                "meal_period": meal,
                "items":       items,
            }, on_conflict="hall_slug,date,meal_period").execute()
            print(f"{len(items)} items saved")

        browser.close()
    print("Done.")

if __name__ == "__main__":
    main()
