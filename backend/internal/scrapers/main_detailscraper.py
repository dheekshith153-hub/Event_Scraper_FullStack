# -*- coding: utf-8 -*-
"""
Detail scraper entry point — replaces cmd/detailscraper/main.go.
Enriches existing events with full descriptions and metadata.

Usage: python main_detailscraper.py
"""

import sys
from datetime import datetime

from detail_scraper import DetailScraper


def main():
    print("=" * 60)
    print(f"  Detail Scraper (Python) — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    scraper = DetailScraper()
    scraper.scrape()

    print("\n" + "=" * 60)
    print("  Detail Scraper: Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
