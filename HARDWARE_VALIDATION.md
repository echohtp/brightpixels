# 1.0 validation gate

The performance and diagnostic APIs are implemented. The version remains 0.5.0
until the remaining real-device checks are recorded; this file is not a claim
that those checks passed. npm publication remains deferred.

## Record on actual hardware

1. Open `/hardware.html` and record the display model, OS/browser, power and HDR settings.
2. Compare HDR on/off and auto/high/low while scrolling the same section. Record whether stutter changes.
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

Before 1.0: resolve reproducible failures, review the documented API contract,
record tested combinations and known limitations, synchronize version metadata,
and complete the separately deferred package release.
