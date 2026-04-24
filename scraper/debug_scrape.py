#!/usr/bin/env python3
"""Debug: capture all network requests and page content for one URL."""
import sys
from playwright.sync_api import sync_playwright

URL = f"https://dineoncampus.com/NYUeats/whats-on-the-menu/nyu-eats-at-lipton/2026-04-24/breakfast"

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()

    all_reqs = []
    def on_req(r):
        all_reqs.append(r.url)
    page.on("request", on_req)

    page.goto(URL, wait_until="networkidle", timeout=30000)

    # Print all URLs fetched
    print("=== REQUESTS ===")
    for u in all_reqs:
        if "api." in u or "menu" in u.lower() or "location" in u.lower():
            print(u)

    # Print visible text on page
    print("\n=== PAGE TEXT (first 3000 chars) ===")
    print(page.inner_text("body")[:3000])

    browser.close()
