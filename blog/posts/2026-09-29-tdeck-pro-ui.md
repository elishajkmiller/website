---
title: T-Deck Pro UI on Meshtastic
date: 2026-09-29
description: My own launcher, texting app, navigation and radio finder for the LilyGO T-Deck Pro, built as an overlay on official Meshtastic.
categories: [Hardware, Open Source, ESP32]
---

Source: [github.com/elishajkmiller/tdeck-pro-nav](https://github.com/elishajkmiller/tdeck-pro-nav). It pairs with my [Watchy firmware](/blog/posts/2026-09-29-watchy-firmware.html).

Official Meshtastic firmware + my own UI layer. Nothing in Meshtastic's core is hand-edited.
Currently built on Meshtastic 2.7.26 (`v2.7.26.54e0d8d`) for the LilyGO T-Deck Pro V1.0
(ESP32-S3, 240x320 e-paper, keyboard, touch).

## Building and flashing

- `overlay/`  new files copied into a fresh checkout of a release
- `patches/`  small hooks into Meshtastic's code, applied in order with `git apply`
- `build.sh <tag>`  fetch that release, reset it to pristine, add the overlay and patches, build with PlatformIO
  (environment `t-deck-pro`; result in `out/<tag>/app-t-deck-pro.bin`)
- `flash.sh <tag>`  write the app partition (0x10000 only) to the T-Deck Pro; settings, channels and Wi-Fi are kept
- `shared/`  files the watch firmware (`~/watchy-build`) and this build both use (the Watchy link protocol)
- `tools/`  a mock message server for testing the Inbox

On a new Meshtastic release: `./build.sh <new-tag>`. If a patch fails to apply, the release changed the code
it hooks into and that one hook needs adjusting; everything else keeps working.
Backup of the original 16 MB flash: ~/tdeck-backup/tdeck-pro-flash-16MB.bin

## The patches

Four patches, grouped by what they touch. Each starts with a plain-text list of what is in it (`git apply` ignores it).
They are written straight from `git diff` against the release, so after `build.sh` the tree is exactly the release plus these.

| Patch | Files | What it does |
|---|---|---|
| `0001-ui-hooks` | Screen.cpp/.h, Modules.cpp, UIRenderer.cpp, CannedMessageModule.cpp, TDeckProKeyboard.cpp | my screens (Home, Watchy, Navigate, Inbox) in the frame list, Home first, every key and tap to `Launcher::handleInput` first; the text message frame draws `Messages::drawFrame`; my screens kept when Meshtastic rebuilds its frames; W A S D become arrows (not while typing); Delete or a tap closes a plain notice; short boot logo; WatchyLink started; bottom nav bar hidden; typing no longer starts a message; Alt gives numbers |
| `0002-messages` | MessageRenderer.cpp/.h, MessageStore.cpp | chat scrolls on e-ink, oldest at top and newest at the bottom, clock times (`formatMessageTime`, also used by the list), no time shown when it is not known, untrustworthy stored times dropped on load, line cache stops when full |
| `0003-boot-and-debug` | GPS.cpp, OSThread.cpp | u-blox M10 GPS setup runs once (NVS `gpscfg` / `m10v1`); `Slow job: NAME ran for N ms` log |
| `0004-build-config` | t-deck-pro/platformio.ini | ArduinoJson and SensorLib, `MESSAGE_HISTORY_LIMIT=60`, leaves out ATAK, detection sensor, people counter, store-and-forward and range test (the app partition is full) |

Adding a hook: edit the file in `~/meshtastic-firmware` (a build leaves it patched), then regenerate that group's patch with
`git diff -- <its files>` (keep the text header). Check with `./build.sh` and `git diff | sha256sum` before and after.

## Where things live (`overlay/src/`)

| File | What it is |
|---|---|
| `graphics/launcher/Launcher.*` | Home screen (tiles: Messages, Contacts, Map, Settings, Watchy, Radios, Inbox, Finder), the Watchy screen, first look at all input. Home has no highlight: only a tap or long press on a tile opens it |
| `graphics/launcher/Navigate.*` | one frame that serves Map (turn-by-turn), Settings (Wi-Fi, Inbox setup), Radios (the Radio Finder map) and Finder, by mode. Also the background worker task, radio-hold flag, CPU speed control, internet clock sync, and the "main loop stalled" watcher |
| `graphics/launcher/Finder.*` | the Finder: list with All / Wi-Fi / Bluetooth / Mesh tabs, then the live hot/cold screen with the steering arrow and sweep strip |
| `graphics/launcher/Gyro.*` | the gyro chip (BHI260AP): loads its firmware and keeps the newest orientation. It is a main-loop job (`GyroThread`): the chip is on the shared I2C wires, so it must never be talked to from another task |
| `graphics/launcher/Messages.*` | Messages like a texting app: one row per conversation (each person with direct messages, each channel), newest first, unread dot and count on the Home tile. Tap or Enter opens the conversation in Meshtastic's own chat screen (bubbles, scrolls up/down, Enter = Reply menu) filtered to it; Delete goes back to the list, swipe left/right moves to the next chat |
| `graphics/launcher/Inbox.*` | message inbox fetched from a server over your saved Wi-Fi (settings in `InboxDefaults.h`) |
| `modules/WatchyLink*` | messages to the watch over ESP-NOW |

## How it works

**Screens and input.** Meshtastic's UI is a list of frames. I add Home (frame 0), Watchy, Navigate and Inbox.
`Screen::handleInputEvent` calls `Launcher::handleInput` first; if it uses the event, Meshtastic never sees it.
Touch events carry x/y coordinates; keyboard events have 0,0, which is how they are told apart. Delete on any
screen but Home goes Home; on Home it does nothing (Meshtastic's own handler would step to the previous frame,
which wraps round to the Inbox).

**Threads.** Meshtastic's main loop runs everything (screen, input, radio, modules) one small job at a time, so
anything slow there freezes the whole device. Slow work runs in separate FreeRTOS tasks: the Navigate worker
(scans, Inbox checks, clock sync) and the Finder's list-scan and live tasks. Tasks never draw; they call
`screen->runNow()` and the main task draws. Shared data uses a lock the drawing side only waits on briefly.
**Exception: anything on the I2C wires (the gyro chip, like touch, keyboard and battery gauge) is only touched
from the main loop.** The wire library is not safe for two tasks at once. Running the gyro from its own task made
its update call hang, kept that task permanently runnable, and starved the screen (every character drawn cost a
10 ms time slice, so redraws took 4-6 s and Delete lagged).

**Hardware limits that shaped the design**
- E-paper: about 1 s per redraw. Redraw only when something on screen would look different.
- One I2C bus is shared by touch (CST328), keyboard (TCA8418), gyro (BHI260AP), fuel gauge (BQ27220) and
  charger. Long transfers slow all of them, so the gyro's firmware load (about 3 s at 400 kHz) is done once,
  a while after boot, when the device is idle.
- One 2.4 GHz radio for Wi-Fi, Bluetooth and the Watchy link. `Navigate::wifiInUse()` tells the Watchy link to
  stay off while a scan or Inbox check is running.
- No battery-backed clock: time comes from GPS, or from the internet (NTP) over the saved Wi-Fi. Timezone is the
  device setting `device.tzdef` (Central: `CST6CDT,M3.2.0,M11.1.0`).
- No magnetometer: the gyro only knows how far you have turned. Heading needs an anchor (`q` / `e`, GPS
  movement, or a known direction). Chip X axis holds steady when the device is tilted, and turning clockwise
  lowers the chip's X angle.
- CPU idles at 80 MHz (Meshtastic's choice) and runs at 240 MHz while you use it, then drops back after 20 s.

**Radio Finder (Radios tile).** One map of mesh nodes (from their GPS), Wi-Fi networks and Bluetooth devices
(placed by fitting several signal-strength readings from spread-out spots; a Wi-Fi and Bluetooth address that
belong to one device are merged). Placing needs 3 or more scans spread in two directions, and indoor GPS is too
rough, so indoors most things stay in the list (`l`) with a distance only. Keys: Enter scan, `l` list/map,
`w a s d` pan, `b` `v` zoom, `z` recenter, `n` north-up, `q` `e` turn "up" 15 degrees, space pause turning.

**Finder (Finder tile).** Pick one Wi-Fi network, Bluetooth device or mesh node. Wi-Fi is read about 3 times a
second on the network's own channel, Bluetooth once a second, a mesh node whenever it transmits. The screen
shows the signal (dBm, or dB for mesh), HOT / WARM / COOL / COLD, a warmer/colder arrow, a rough distance, and:
a steering arrow toward the strongest direction found so far, and a sweep strip (a flat panorama of every
reading by where the device pointed). Keys: `q` `e` set/nudge north, `i` flip up/down (chip axis sign not
verified), `c` clear, space pause, Delete back.

## Route parsing (Navigate)

The OSRM reply is filtered while it is read (ArduinoJson 6). Two traps, both hit once: build the filter as one full
expression (`filter["routes"][0]["legs"][0]["steps"][0]["name"] = true`), because taking a `JsonObject` of the steps
element gives a null object and the filter then drops every step ("No route found" for every route); and raise the
nesting limit to 20 (the reply nests deeper than the default 10, error `TooDeep`). A copy of the parsing lives in the
session scratch as a small C++ test; real responses for Joplin routes gave 5, 18 and 26 steps.

## Navigation map (Navigate, S_NAV)

While navigating, the screen shows the turn arrow, distance and road on top and a map that follows you below: you are
the arrow near the bottom, "up" is the way you are moving (worked out from where you were 8+ m ago; until you move it is
the route direction), the real road shape ahead is thick, where you have been is thin, the circle is the next turn, the
square the destination. The dashed arrow from you is the direction the route wants you to go (about 40 m ahead along
it). Small compass in the corner shows north. Up/Down (or W/S) zoom, Enter switches to the whole route north-up.
Route shape comes from the per-step `geometry` of the OSRM reply (polyline, thinned to 2000 points).

**App partition is full** (2368 KB; about 30 KB free with the tile code in). More features (e.g. map tiles with a PNG decoder) need
more room: either trim more modules, or resize the partition table (there are ~12 MB of unused flash after 0x400000,
but settings and messages live in the 1 MB spiffs at 0x300000, so that partition must not move).

## Map tiles (Tiles.*, TileCodec.h)

Street tiles from OpenStreetMap, kept on the SD card (must be **FAT32**: run `sudo tools/prepare_sd.sh /dev/sdX` with
the card in the laptop; it backs the card up first). When a route is made (on the saved Wi-Fi) the T-Deck downloads
the tiles for zoom 14, 15 and 16 around the start, around the destination and along the route (at most 150), one HTTPS
connection, named in the User-Agent, stopping at the first refusal (403/429). `TileCodec.h` turns each PNG into a 1-bit
256x256 tile (dark pixels stay ink, near-white stays paper, greys become a light dot pattern) using the chip's built-in
inflate (ROM `tinfl_decompress`, no library): 8 KB per tile at `/maps/<z>/<x>/<y>.t1`. `TileCodec.h` is portable and was
checked bit for bit against an independent Python version on real tiles (palette, RGB, RGBA, grey, grey+alpha).
While navigating, `Tiles::drawMap` samples the tiles for every map pixel (rotated to your heading) and the route is
drawn over them with a paper outline. Up to 6 tiles are held in RAM (48 KB) while the map is on screen and freed after.
Street names are part of the picture, so they turn with the map. Nothing is fetched while navigating.
OpenStreetMap's tile policy forbids bulk downloading, so keep the area small. The server blocks made-up or generic
User-Agents (a test one containing "test" got a 403 image): keep `TDeckProNavigator/1.0 (personal use)`.

## Debugging

- USB log: `~/watchy-build/capture_log.py OUT SECONDS [USB_SERIAL]`, run with `~/tdeck-tools/bin/python`. Read it
  with `sed 's/\x1b\[[0-9;]*m//g; s/\r//' OUT | grep -a ...`. Serial for this device: 28:37:2F:91:20:98.
- `Main loop stalled N ms (was doing: ...)` and `Slow job: NAME ran for N ms` in the log mean the main loop was held
  up; the second names the job, the first says what my background tasks were doing. Also `Finder: drawing ... took`.
- Finding a task that never sleeps: sample `eTaskGetState(xTaskGetHandle("name"))` 20 times; a task that is
  `eReady` every time is spinning (`vTaskList` is not compiled into this build).
- Settings: `~/tdeck-tools/bin/meshtastic --port /dev/ttyACM0 --get/--set ...` (retry: it times out sometimes
  right after a reboot).
- Flashing: `esptool ... hard-reset` restarts the device without changing anything.
- After flashing, the e-paper may show the old screen until something redraws it.

## Known issues / not done

- Boot: Home is usable at about 8 s. Remaining blocking steps: PMU 1.9 s at 7 s, GPS chip detection two 1 s steps at 10-11 s, and
  the gyro firmware load (3.3 s, main loop) once at 30 s uptime and 8 s idle. (The 10 s GPS setup is now skipped, in `0003-boot-and-debug`.)
- A Wi-Fi scan in the Finder's live view stalls the main loop for about 2 s per reading.
- Finder up/down direction (`i`) and gyro drift have not been measured on the hardware.
- 4G modem: fitted, a SIMCom A7682E (Europe/Asia variant: LTE 1/3/5/7/8/20 + 2G 900/1800), so it sees few or no US towers. No SIM tested. The test screen is parked in `parked/modem/` (not built); AT commands answered fine on RX 11 / TX 10 after a PWRKEY pulse. Its GNSS was not compared with the main u-blox GPS.
