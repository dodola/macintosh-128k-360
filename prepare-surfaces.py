"""Calibrate the two generated source images to the model's surface coordinates."""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def calibrate_profile(image, source, profile, reverse=False):
    width, height = 692, 840
    z, y = profile.T
    normalized_z = (z - z.min()) / (z.max() - z.min())
    target = np.column_stack(
        ((normalized_z if reverse else 1 - normalized_z) * (width - 1),
         (y.max() - y) / (y.max() - y.min()) * (height - 1))
    ).astype(np.float32)
    pixels = np.zeros((height, width, 4), dtype=np.uint8)
    source_center, target_center = source.mean(axis=0), target.mean(axis=0)
    source_rgb = np.asarray(image.convert("RGB"))
    for i in range(len(source)):
        j = (i + 1) % len(source)
        src = np.array([source_center, source[i], source[j]], dtype=np.float32)
        dst = np.array([target_center, target[i], target[j]], dtype=np.float32)
        matrix = cv2.getAffineTransform(src, dst)
        tile = cv2.warpAffine(source_rgb, matrix, (width, height), flags=cv2.INTER_CUBIC)
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.fillConvexPoly(mask, np.rint(dst).astype(np.int32), 255)
        pixels[mask > 0, :3] = tile[mask > 0]
        pixels[mask > 0, 3] = 255
    return Image.fromarray(pixels)


def shoulder(image):
    width, height = 1024, 161
    source = np.array([[88, 12], [1110, 12], [1177, 185], [20, 185]], dtype=np.float32)
    target = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(source, target)
    return Image.fromarray(cv2.warpPerspective(np.asarray(image), matrix, (width, height), flags=cv2.INTER_CUBIC))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("turnaround", type=Path)
    parser.add_argument("rear", type=Path)
    args = parser.parse_args()
    assets = Path(__file__).parent / "assets"
    calibration = json.loads((assets / "calibration.json").read_text())
    atlas = Image.open(args.turnaround).convert("RGB")
    rear = Image.open(args.rear).convert("RGB")
    profile = np.array(calibration["profile"], dtype=np.float32)
    textures = {
        "front": atlas.crop((105, 24, 456, 441)),
        "front-base": atlas.crop((108, 445, 454, 483)),
        "rear": rear.crop((19, 185, 1180, 1281)),
        "shoulder": shoulder(rear),
        "left": calibrate_profile(atlas, np.array(calibration["leftPhoto"], dtype=np.float32), profile, reverse=True),
        "right": calibrate_profile(atlas, np.array(calibration["rightPhoto"], dtype=np.float32), profile),
        "roof": atlas.crop((597, 547, 942, 896)),
        "bottom": atlas.crop((1087, 536, 1442, 958)),
        "rear-detail": rear.crop((14, 7, 1186, 1308)),
    }
    for name, image in textures.items():
        image.save(assets / (name + ".webp"), "WEBP", quality=94, method=6)


if __name__ == "__main__":
    main()
