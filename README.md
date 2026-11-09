# Macintosh 128K · 360° Exhibit

An interactive reconstruction of the original 1984 Macintosh. Drag to orbit the case, switch between the four preset views, or zoom into the rear connector panel. The interface is in Simplified Chinese.

The case uses oriented Gaussian splats colored by GPT Image–generated textures. The rear layout follows the early M0001. The finish and label artwork are reconstructions.

## Run locally

The committed build lives in `dist/`. Serve it with any static HTTP server. For example:

```sh
python -m http.server 8000 --directory dist
```

Open [the local exhibit](http://localhost:8000).

## Rebuild

```sh
npm ci
npm run build
```

The calibrated textures and [generation prompts](assets/generation-prompts.txt) are in `assets/`. The calibration script accepts the original generated turnaround and rear images as inputs. A regular build uses the calibrated textures already included in the repository.
