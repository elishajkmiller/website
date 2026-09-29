---
title: Watchy firmware with a T-Deck link
date: 2026-09-29
description: A solar ring watch face for the Watchy v3, with texts forwarded from a T-Deck Pro over encrypted ESP-NOW.
categories: [Hardware, Open Source, ESP32]
---

Source: [github.com/elishajkmiller/watchy-firmware](https://github.com/elishajkmiller/watchy-firmware). The other half is the [T-Deck Pro UI](/blog/posts/2026-09-29-tdeck-pro-ui.html).

Custom firmware for a Watchy v3 (ESP32-S3). It starts from SQFMI's 7_SEG face and reworks it into a solar ring face: 12-hour clock, Fahrenheit, sunrise and sunset, and light-mode menus. Saved Wi-Fi and the clock survive resets, there is a USB Flash Mode in the menu, and an encrypted ESP-NOW link receives texts from a T-Deck Pro (see the T-Deck post).

## Setup

Put your weather key in `src/settings.h` (`OPENWEATHERMAP_APIKEY`) and your location. Copy `lib/Watchy/src/WatchyLinkSecret.h.example` to `WatchyLinkSecret.h` and fill in random keys; the T-Deck needs the same file. Build with `pio run` and flash with `flash.sh`.

The Watchy library in `lib/Watchy` is SQFMI's, with my edits, under its own license.
