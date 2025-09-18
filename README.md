# Contours Studio – Aeron Dining Table Experience

This project provides a scroll-driven product story for the Aeron dining table. The hero section introduces the piece and the main sequence blends large render frames into a smooth animation that responds directly to the visitor's scroll position.

## Features

- **Scroll-synced render** – A `<canvas>` element streams high-resolution frames as the visitor scrolls, keeping memory use low by caching a limited neighborhood of images.
- **Responsive art direction** – Layout adapts from widescreen displays to mobile with a sticky canvas experience and contextual navigation.
- **Accessibility & performance** – Honors `prefers-reduced-motion`, exposes navigation controls for keyboard use, and progressively warms the cache in idle time so the first frames appear instantly.

## Using your own render frames

1. Replace the sample SVG files inside `assets/frames/` with the production renders for your table. Use a consistent naming convention, e.g. `frame_0001.webp`, `frame_0002.webp`, etc. Compressed WebP or AVIF files provide the best balance of quality and size.
2. Update the `data-frame-count`, `data-file-prefix`, and `data-file-extension` attributes on the `<canvas id="product-sequence">` element in `index.html` to reflect the new sequence. The prefix should include the relative path to your frames.
3. If you generate more than ~150 frames, consider increasing `data-preload-count` gradually to keep the nearest frames ready without overwhelming the network.
4. For a single hero image experience (e.g. on older devices), simply reduce the frame count to `1` and provide only the first frame.

## Local development

A lightweight static server is enough to preview the experience:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/` in your browser.

## Customisation ideas

- Swap the color tokens in `styles.css` to match your brand palette.
- Replace the copy in the hero, feature, and process sections with your own story, keeping the existing semantic structure for SEO.
- Integrate an analytics or lead form service by adding scripts just before the closing `</body>` tag.

## License

All code in this repository is provided as-is for demonstration purposes.
