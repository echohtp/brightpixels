# 1.0 hardware validation status

Version 1.0.0 ships the documented rendering and diagnostic APIs. The real-device
checks below remain unverified; a stable API version does not establish display
compatibility.

## Record on actual hardware

1. Open `/hardware.html` and record the display model, OS/browser, power and HDR settings.
2. Compare HDR on/off and auto/high/low while scrolling the same section. Record your observations.
3. Test loading, progress and pulse; scroll away and back, then move the window between HDR and SDR monitors where available.
4. Copy the JSON report with white/color/motion observations. Attach it to a GitHub issue with reproduction steps for any failure.

| Display/browser combination | Physical HDR/color observation | Scroll quality | Report |
| --- | --- | --- | --- |
| macOS built-in HDR display / Chromium | Not tested | Not tested | Pending |
| macOS built-in HDR display / Safari | Not tested | Not tested | Pending |
| SDR display / Chromium or Safari | Not tested | Not tested | Pending |
| External HDR display / supported browser | Not tested | Not tested | Pending |

## Automated evidence

The Verify workflow covers lifecycle, fallbacks, offscreen work, resolution changes,
React/TypeScript integration and software WebGPU. It cannot establish physical
luminance or smooth scrolling on a user's GPU. Use the run for the exact candidate
commit; do not substitute software GPU success for an observation above.

For follow-up patches, record tested combinations and known limitations here.
The GitHub release documents the exact automated checks for its candidate commit.
