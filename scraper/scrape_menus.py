#!/usr/bin/env python3
"""
NYU Dining Menu Scraper

Scrapes dineoncampus.com/NYUeats for all dining halls and meal periods,
then upserts results into the Supabase dining_menu table.

Run daily at noon via GitHub Actions (.github/workflows/scrape_menus.yml).
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment or .env.
"""

import os
import re
import json
from datetime import date
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, Page, Response
from supabase import create_client

load_dotenv()

SITE_URL   = "https://dineoncampus.com/NYUeats"
BASE_URL   = f"{SITE_URL}/whats-on-the-menu"
MEAL_PERIODS = ["breakfast", "lunch", "dinner"]

# Fallback list if dynamic discovery fails
FALLBACK_HALLS = [
    ("nyu-eats-at-downstein",  "Downstein"),
    ("nyu-eats-at-lipton",     "Lipton"),
    ("nyu-eats-at-third-north","Third North"),
    ("nyu-eats-at-palladium",  "Palladium"),
]


def discover_halls(page: Page) -> list[tuple[str, str]]:
    """Visit the main menu page and extract all dining hall slugs from nav links."""
    page.goto(BASE_URL, wait_until="networkidle", timeout=30000)

    links: list[str] = page.eval_on_selector_all(
        "a[href*='whats-on-the-menu']",
        "els => els.map(e => e.href)"
    )

    halls: dict[str, str] = {}
    for link in links:
        m = re.search(r"whats-on-the-menu/([^/?#]+)", link)
        if not m:
            continue
        slug = m.group(1)
        # Skip date-like segments and the bare "whats-on-the-menu" path
        if re.match(r"\d{4}-\d{2}-\d{2}", slug) or slug in MEAL_PERIODS:
            continue
        if slug not in halls:
            label = slug.replace("nyu-eats-at-", "").replace("-", " ").title()
            halls[slug] = label

    return list(halls.items()) or FALLBACK_HALLS


def _parse_api_responses(responses: list[dict]) -> list[dict]:
    """
    Extract menu items from intercepted dineoncampus API JSON.
    Expected shape: { menu: { periods: [{ categories: [{ name, items: [{name}] }] }] } }
    """
    items: list[dict] = []
    for resp in responses:
        menu = resp.get("menu") or {}
        for period in menu.get("periods", []):
            for category in period.get("categories", []):
                cat_name = category.get("name", "")
                for item in category.get("items", []):
                    name = (item.get("name") or "").strip()
                    if name:
                        items.append({"name": name, "category": cat_name})
    return items


def _parse_dom_fallback(page: Page) -> list[dict]:
    """
    Last-resort DOM parse — tries common selectors used by dineoncampus.
    Returns items without category info.
    """
    items: list[dict] = []
    selectors = [
        "[data-recipe-id]",
        ".rec-name",
        ".menu-item-name",
        "[class*='menuItem'] [class*='name']",
    ]
    for selector in selectors:
        try:
            handles = page.query_selector_all(selector)
            for h in handles:
                text = (h.inner_text() or "").strip().split("\n")[0]
                if text and len(text) > 2:
                    items.append({"name": text, "category": ""})
            if items:
                break
        except Exception:
            continue
    return items


def scrape_meal(page: Page, slug: str, target_date: str, meal: str) -> list[dict]:
    """Navigate to a single hall/meal URL, intercept the API call, and return items."""
    url = f"{BASE_URL}/{slug}/{target_date}/{meal}"
    captured: list[dict] = []

    def on_response(response: Response) -> None:
        if "api.dineoncampus.com" not in response.url:
            return
        try:
            data = response.json()
            captured.append(data)
        except Exception:
            pass

    page.on("response", on_response)
    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
    except Exception:
        pass
    finally:
        page.remove_listener("response", on_response)

    items = _parse_api_responses(captured)
    if not items:
        items = _parse_dom_fallback(page)
    return items


def main() -> None:
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    db = create_client(supabase_url, supabase_key)
    today = date.today().isoformat()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        print("Discovering dining halls...")
        try:
            halls = discover_halls(page)
        except Exception as e:
            print(f"Discovery failed ({e}), using fallback list")
            halls = FALLBACK_HALLS

        print(f"Halls: {[name for _, name in halls]}")

        for slug, hall_name in halls:
            for meal in MEAL_PERIODS:
                print(f"  {hall_name} / {meal} ...", end=" ", flush=True)
                try:
                    items = scrape_meal(page, slug, today, meal)
                    if items:
                        db.table("dining_menu").upsert(
                            {
                                "hall_name":   hall_name,
                                "hall_slug":   slug,
                                "date":        today,
                                "meal_period": meal,
                                "items":       items,
                            },
                            on_conflict="hall_slug,date,meal_period",
                        ).execute()
                        print(f"{len(items)} items saved")
                    else:
                        print("no items (not served?)")
                except Exception as e:
                    print(f"ERROR: {e}")

        browser.close()

    print("Done.")


if __name__ == "__main__":
    main()
