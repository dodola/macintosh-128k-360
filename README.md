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

This build uses the calibrated textures already included in the repository. To regenerate them from the source images, follow the workflow below.

## Reproduce the splat workflow

1. **Generate the views.** The [GPT Image prompts](assets/generation-prompts.txt) produced a [six-view turnaround](assets/source/mac-turnaround.png) and a [higher-resolution rear view](assets/source/mac-rear.png). The rear view supplies the connector panel and label.
2. **Calibrate the images.** [The preparation script](prepare-surfaces.py) crops the flat faces, rectifies the rear shoulder with a perspective warp, and aligns the side silhouettes to the case profile with piecewise affine transforms. [The calibration file](assets/calibration.json) holds the side landmarks and the 3D case profile. When substituting images, update the crop rectangles in the script and the landmarks in the calibration file.
3. **Render the splats.** [The scene](exhibit.js) places each calibrated WebP on a face of the case. [The WebGL2 shader](splat.js) generates a grid of oriented Gaussian quads on those faces, samples the image for color, and applies Gaussian opacity. Orbiting the camera changes how each footprint projects onto the screen.

Run these commands from the repository root with Python 3.13 and Node.js. The Python dependencies can be installed in a virtual environment.

```sh
python -m pip install -r requirements-splats.txt
python prepare-surfaces.py assets/source/mac-turnaround.png assets/source/mac-rear.png
npm ci
npm run build
python -m http.server 8000 --directory dist
```

The Python step writes nine WebP maps into `assets/`. The JavaScript build embeds those maps into `dist/app.js`, and the browser constructs the splats at runtime from the calibrated case geometry.
