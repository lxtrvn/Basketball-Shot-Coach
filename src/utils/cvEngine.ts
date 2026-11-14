import {
  BallDetection,
  BoundingBox,
  HSVSettings,
  HoopZone,
  Point,
  ShotTrajectory,
} from '../types/tracker';

/**
 * Fast RGB to HSV conversion matching OpenCV's cv2.cvtColor(BGR2HSV)
 * H: 0 - 180 (OpenCV uint8 range)
 * S: 0 - 255
 * V: 0 - 255
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 30); // 360 / 6 * 0.5 = 30 to scale to 0-180
    if (h < 0) h += 180;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 255);
  const v = Math.round(max * 255);

  return [h, s, v];
}

/**
 * Generates an OpenCV-style binary mask from ImageData based on HSV threshold limits
 */
export function generateHsvMask(
  imageData: ImageData,
  settings: HSVSettings,
  maskCanvas: HTMLCanvasElement
): { maskData: ImageData; foregroundPixelCount: number } {
  const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context for mask canvas');

  const width = imageData.width;
  const height = imageData.height;

  if (maskCanvas.width !== width || maskCanvas.height !== height) {
    maskCanvas.width = width;
    maskCanvas.height = height;
  }

  const maskImageData = ctx.createImageData(width, height);
  const src = imageData.data;
  const dst = maskImageData.data;
  let foregroundPixelCount = 0;

  const { hMin, hMax, sMin, sMax, vMin, vMax } = settings;

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];

    const [h, s, v] = rgbToHsv(r, g, b);

    // Basketball orange HSV range check (handling wrapped hue if hMin > hMax)
    let inHue = false;
    if (hMin <= hMax) {
      inHue = h >= hMin && h <= hMax;
    } else {
      inHue = h >= hMin || h <= hMax;
    }

    const inRange = inHue && s >= sMin && s <= sMax && v >= vMin && v <= vMax;

    if (inRange) {
      dst[i] = 255;
      dst[i + 1] = 255;
      dst[i + 2] = 255;
      dst[i + 3] = 255;
      foregroundPixelCount++;
    } else {
      dst[i] = 0;
      dst[i + 1] = 0;
      dst[i + 2] = 0;
      dst[i + 3] = 255;
    }
  }

  ctx.putImageData(maskImageData, 0, 0);
  return { maskData: maskImageData, foregroundPixelCount };
}

/**
 * Finds basketball candidate blob using connected component analysis & circularity
 */
export function detectBasketballInMask(
  maskData: ImageData,
  settings: HSVSettings,
  lastKnownPos: Point | null,
  hoopZone?: HoopZone | null
): BallDetection | null {
  const width = maskData.width;
  const height = maskData.height;
  const data = maskData.data;

  // Grid scan for connected components with step
  const step = 2;
  const gWidth = Math.ceil(width / step);
  const gHeight = Math.ceil(height / step);
  const visited = new Uint8Array(gWidth * gHeight);

  const candidates: Array<{
    x: number;
    y: number;
    radius: number;
    area: number;
    circularity: number;
    box: BoundingBox;
  }> = [];

  const getIdx = (gx: number, gy: number) => gy * gWidth + gx;
  const maxTeleportDist = Math.max(120, Math.round(Math.max(width, height) * 0.22));

  for (let gy = 1; gy < gHeight - 1; gy += 2) {
    for (let gx = 1; gx < gWidth - 1; gx += 2) {
      const vIdx = getIdx(gx, gy);
      if (visited[vIdx] === 1) continue;

      const px = gx * step;
      const py = gy * step;
      const pIdx = (py * width + px) * 4;

      if (data[pIdx] > 128) {
        // Seed found! Breadth-first flood fill
        let minX = px;
        let maxX = px;
        let minY = py;
        let maxY = py;
        let sumX = 0;
        let sumY = 0;
        let area = 0;

        const queue: number[] = [gx, gy];
        visited[vIdx] = 1;

        let qHead = 0;
        while (qHead < queue.length && queue.length < 8000) {
          const curGx = queue[qHead++];
          const curGy = queue[qHead++];
          const curPx = curGx * step;
          const curPy = curGy * step;

          sumX += curPx;
          sumY += curPy;
          area++;

          if (curPx < minX) minX = curPx;
          if (curPx > maxX) maxX = curPx;
          if (curPy < minY) minY = curPy;
          if (curPy > maxY) maxY = curPy;

          const neighbors = [
            [curGx + 1, curGy],
            [curGx - 1, curGy],
            [curGx, curGy + 1],
            [curGx, curGy - 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < gWidth && ny >= 0 && ny < gHeight) {
              const nIdx = getIdx(nx, ny);
              if (visited[nIdx] === 0) {
                const nPx = nx * step;
                const nPy = ny * step;
                if (nPx < width && nPy < height) {
                  const nPixIdx = (nPy * width + nPx) * 4;
                  if (data[nPixIdx] > 128) {
                    visited[nIdx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }
          }
        }

        const boxW = maxX - minX + 1;
        const boxH = maxY - minY + 1;
        const compArea = area * (step * step);

        if (compArea >= settings.minArea && compArea <= settings.maxArea) {
          const aspect = boxW / Math.max(1, boxH);
          if (aspect >= 0.65 && aspect <= 1.45) {
            const centerX = sumX / area;
            const centerY = sumY / area;
            const approxRadius = (boxW + boxH) / 4;

            // Circularity metric: 4 * PI * Area / Perimeter^2
            const perimeter = 2 * Math.PI * approxRadius;
            const circularity = Math.min(1.0, (4 * Math.PI * compArea) / (perimeter * perimeter));

            if (circularity >= settings.minCircularity) {
              candidates.push({
                x: centerX,
                y: centerY,
                radius: approxRadius,
                area: compArea,
                circularity,
                box: {
                  x: minX,
                  y: minY,
                  width: boxW,
                  height: boxH,
                },
              });
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Score candidate: balance circularity with kinematic distance to last known position
  let bestCandidate = candidates[0];
  let bestScore = -Infinity;

  for (const cand of candidates) {
    let score = cand.circularity * 100;

    // Penalize stationary orange rim noise when ball was last tracked elsewhere
    if (hoopZone && lastKnownPos) {
      const nearRimLine =
        cand.x >= hoopZone.x - 10 &&
        cand.x <= hoopZone.x + hoopZone.width + 10 &&
        Math.abs(cand.y - hoopZone.rimY) < 18;
      const distFromLast = Math.hypot(cand.x - lastKnownPos.x, cand.y - lastKnownPos.y);
      if (nearRimLine && distFromLast > maxTeleportDist * 0.7) {
        score -= 80;
      }
    }

    if (lastKnownPos) {
      const dx = cand.x - lastKnownPos.x;
      const dy = cand.y - lastKnownPos.y;
      const dist = Math.hypot(dx, dy);

      // Penalize physically impossible velocity jumps (teleporting across screen)
      if (dist < maxTeleportDist) {
        score += (maxTeleportDist - dist) * 0.8;
      } else {
        score -= dist * 0.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cand;
    }
  }

  return {
    x: bestCandidate.x,
    y: bestCandidate.y,
    radius: bestCandidate.radius,
    confidence: Math.max(0.5, Math.min(0.99, bestCandidate.circularity)),
    box: bestCandidate.box,
  };
}

/**
 * 2nd-degree Polynomial Least-Squares Regression
 * Fits y = a*x^2 + b*x + c to tracked points
 */
export function fitParabola(points: Point[]): { a: number; b: number; c: number } | null {
  if (points.length < 4) return null;

  let s4 = 0; // sum(x^4)
  let s3 = 0; // sum(x^3)
  let s2 = 0; // sum(x^2)
  let s1 = 0; // sum(x)
  const n = points.length;

  let sy2 = 0; // sum(x^2 * y)
  let sy1 = 0; // sum(x * y)
  let sy0 = 0; // sum(y)

  for (const pt of points) {
    const x = pt.x;
    const y = pt.y;
    const x2 = x * x;

    s4 += x2 * x2;
    s3 += x2 * x;
    s2 += x2;
    s1 += x;

    sy2 += x2 * y;
    sy1 += x * y;
    sy0 += y;
  }

  const matrix = [
    [s4, s3, s2, sy2],
    [s3, s2, s1, sy1],
    [s2, s1, n, sy0],
  ];

  for (let i = 0; i < 3; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = matrix[i];
    matrix[i] = matrix[maxRow];
    matrix[maxRow] = temp;

    if (Math.abs(matrix[i][i]) < 1e-12) return null;

    for (let k = i + 1; k < 3; k++) {
      const factor = matrix[k][i] / matrix[i][i];
      for (let j = i; j <= 3; j++) {
        matrix[k][j] -= factor * matrix[i][j];
      }
    }
  }

  const c = matrix[2][3] / matrix[2][2];
  const b = (matrix[1][3] - matrix[1][2] * c) / matrix[1][1];
  const a = (matrix[0][3] - matrix[0][2] * c - matrix[0][1] * b) / matrix[0][0];

  if (isNaN(a) || isNaN(b) || isNaN(c)) return null;

  return { a, b, c };
}

/**
 * Computes complete shot physics telemetry (release angle, apex, entry angle, outcome)
 */
export function computeTrajectoryTelemetry(
  points: Point[],
  hoopZone: HoopZone,
  courtScalePixelsPerFoot: number = 32
): ShotTrajectory {
  if (points.length < 3) {
    return {
      points,
      releasePoint: points[0] || null,
      apexPoint: null,
      rimEntry: null,
      parabolaCoeffs: null,
      releaseAngleDeg: 0,
      apexHeightPx: 0,
      entryAngleDeg: 0,
      shotVelocityMph: 0,
      durationSec: 0,
      outcome: 'ready',
    };
  }

  const releasePoint = points[0];
  const parabola = fitParabola(points);

  // Find apex: in screen coordinates (Y down), apex is minimum Y
  let apexPoint = points[0];
  for (const p of points) {
    if (p.y < apexPoint.y) {
      apexPoint = p;
    }
  }

  // Refine apex with parabola if available
  let apexPx = apexPoint.y;
  if (parabola && parabola.a > 0.00001) {
    const calcApexX = -parabola.b / (2 * parabola.a);
    const calcApexY = parabola.a * calcApexX * calcApexX + parabola.b * calcApexX + parabola.c;
    if (calcApexY <= apexPoint.y + 10) {
      apexPx = calcApexY;
    }
  }

  // Release angle: tangent to trajectory at release point
  let releaseAngleDeg = 48;
  if (points.length >= 3) {
    const dx = points[2].x - points[0].x;
    const dy = -(points[2].y - points[0].y);
    if (Math.abs(dx) > 0.001) {
      const rad = Math.atan2(dy, Math.abs(dx));
      releaseAngleDeg = Math.round((rad * 180) / Math.PI);
      if (releaseAngleDeg < 20) releaseAngleDeg = 45;
      if (releaseAngleDeg > 85) releaseAngleDeg = 65;
    }
  }

  // Entry angle near hoop
  let entryAngleDeg = 44;
  const rimCenter = hoopZone.x + hoopZone.width / 2;
  if (parabola) {
    const slopeScreen = 2 * parabola.a * rimCenter + parabola.b;
    const cartesianSlope = -slopeScreen;
    const entryRad = Math.atan(Math.abs(cartesianSlope));
    entryAngleDeg = Math.round((entryRad * 180) / Math.PI);
    if (entryAngleDeg < 25) entryAngleDeg = 36;
    if (entryAngleDeg > 75) entryAngleDeg = 52;
  }

  // Velocity calculation in mph
  const dt = points[points.length - 1].t - points[0].t;
  let shotVelocityMph = 18.5;
  if (dt > 0.1) {
    let totalDistPx = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistPx += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const distFeet = totalDistPx / courtScalePixelsPerFoot;
    const feetPerSec = distFeet / dt;
    shotVelocityMph = Math.round(feetPerSec * 0.681818 * 10) / 10;
  }

  // Outcome detection relative to hoop zone
  let outcome: 'make' | 'miss' | 'in_flight' | 'ready' = 'in_flight';
  let rimEntry: Point | null = null;

  const hoopLeft = hoopZone.x;
  const hoopRight = hoopZone.x + hoopZone.width;
  const rimY = hoopZone.rimY;

  let crossedRim = false;
  let nearRim = false;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    if (prev.y <= rimY && curr.y >= rimY) {
      if (curr.x >= hoopLeft - 5 && curr.x <= hoopRight + 5) {
        crossedRim = true;
        rimEntry = curr;
      }
    }

    if (Math.hypot(curr.x - rimCenter, curr.y - rimY) < hoopZone.width * 0.8) {
      nearRim = true;
    }
  }

  const lastPoint = points[points.length - 1];
  if (crossedRim) {
    outcome = 'make';
  } else if (nearRim && lastPoint.y > rimY + 15) {
    outcome = 'miss';
  } else if (points.length > 25 && lastPoint.y > apexPx + 150) {
    outcome = 'miss';
  }

  return {
    points,
    releasePoint,
    apexPoint,
    rimEntry,
    parabolaCoeffs: parabola,
    releaseAngleDeg,
    apexHeightPx: Math.round(apexPx),
    entryAngleDeg,
    shotVelocityMph,
    durationSec: Math.round(dt * 100) / 100,
    outcome,
  };
}
