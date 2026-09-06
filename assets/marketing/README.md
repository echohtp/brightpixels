# LinkedIn creative

- `brightpixels-linkedin-source.png`: SDR artwork generated using the built-in image generation tool.
- `brightpixels-linkedin-hdr.png`: actual 16-bit BT.2020/PQ PNG, exported using BrightPixels' image highlight equation at intensity 8. Reference white is 203 nits; encoded maximum is 1624 nits. Display output depends on HDR support and headroom.
- `hdr-preview.html`: uses the actual project web component with the SDR source; serve the repository over localhost or HTTPS.
- `export-hdr.mjs`: reproducible encoder; requires Node and FFmpeg. Linearizes the source, applies the shader's highlight curve, converts primaries, applies PQ, and writes PNG cICP and cLLI chunks.
- `linkedin-post.md`: draft copy. Not posted.

FFprobe verified rgb48be, smpte2084 and bt2020. Physical screen brightness and LinkedIn HDR preservation have not been verified. The live renderer and exported file have different tone-mapping paths and need not look identical.
