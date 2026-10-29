export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

export interface EscapePositionOptions {
  width: number;
  height: number;
  buttonWidth: number;
  buttonHeight: number;
  pointer: Point;
  current: Point;
  obstacles: Rect[];
  sequence: number;
}

const OBSTACLE_GAP = 14;
const EPSILON = .001;

/** Test the full route of the button's top-left point against an expanded obstacle. */
function crossesObstacle(from: Point, to: Point, obstacle: Rect, buttonWidth: number, buttonHeight: number, gap = OBSTACLE_GAP): boolean {
  const left = obstacle.x - buttonWidth - gap + EPSILON;
  const right = obstacle.x + obstacle.width + gap - EPSILON;
  const top = obstacle.y - buttonHeight - gap + EPSILON;
  const bottom = obstacle.y + obstacle.height + gap - EPSILON;
  const startsInside = from.x > left && from.x < right && from.y > top && from.y < bottom;
  if (gap > 0 && startsInside) {
    // A resize or an in-flight animation can start in the safety buffer. Permit
    // leaving that buffer, but never permit crossing the actual obstacle.
    const endsInside = to.x > left && to.x < right && to.y > top && to.y < bottom;
    return endsInside || crossesObstacle(from, to, obstacle, buttonWidth, buttonHeight, 0);
  }
  let enter = 0;
  let leave = 1;
  for (const [start, delta, low, high] of [
    [from.x, to.x - from.x, left, right],
    [from.y, to.y - from.y, top, bottom],
  ]) {
    if (Math.abs(delta) < EPSILON) {
      if (start <= low || start >= high) return false;
      continue;
    }
    const first = (low - start) / delta;
    const second = (high - start) / delta;
    enter = Math.max(enter, Math.min(first, second));
    leave = Math.min(leave, Math.max(first, second));
    if (enter > leave) return false;
  }
  return enter <= leave && leave > 0 && enter < 1;
}

/** All coordinates are relative to the full-page interaction surface. */
export function chooseEscapePosition(options: EscapePositionOptions): Point | null {
  const { width, height, buttonWidth, buttonHeight, pointer, current, obstacles } = options;
  const numbers = [width, height, buttonWidth, buttonHeight, pointer.x, pointer.y, current.x, current.y];
  if (!numbers.every(Number.isFinite) || width <= 0 || height <= 0 || buttonWidth <= 0 || buttonHeight <= 0) return null;
  if (buttonWidth > width || buttonHeight > height) return null;
  if (obstacles.some(rect => ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0)) return null;

  // Keep the usual inset on phones and desktops; still fit unusually small surfaces.
  const insetX = Math.min(16, (width - buttonWidth) / 2);
  const insetY = Math.min(16, (height - buttonHeight) / 2);
  const maxX = width - buttonWidth - insetX;
  const maxY = height - buttonHeight - insetY;
  const center = { x: current.x + buttonWidth / 2, y: current.y + buttonHeight / 2 };
  const dx = center.x - pointer.x;
  const dy = center.y - pointer.y;
  const sequence = Number.isFinite(options.sequence) ? Math.abs(Math.trunc(options.sequence)) : 0;
  // When touched exactly in the center, flee vertically to clear a wide button quickly.
  const angle = Math.hypot(dx, dy) < EPSILON ? (sequence % 2 ? -Math.PI / 2 : Math.PI / 2) : Math.atan2(dy, dx);
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const offsets = [0, 25, -25, 50, -50, 80, -80, 110, -110, 145, -145];
  if (sequence % 2) {
    // Alternate only the side-step preference; straight-away movement stays first.
    for (let i = 1; i < offsets.length; i++) offsets[i] *= -1;
  }
  const seen = new Set<string>();
  const candidates: Point[] = [];
  for (const step of [72, 48, 24, 96]) {
    for (const degrees of offsets) {
      const rotated = angle + degrees * Math.PI / 180;
      const point = {
        x: Math.max(insetX, Math.min(maxX, current.x + Math.cos(rotated) * step)),
        y: Math.max(insetY, Math.min(maxY, current.y + Math.sin(rotated) * step)),
      };
      const key = `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
      const distance = Math.hypot(point.x - current.x, point.y - current.y);
      if (seen.has(key) || distance < 2 || distance > 96 + EPSILON) continue;
      seen.add(key);
      if (obstacles.some(obstacle => crossesObstacle(current, point, obstacle, buttonWidth, buttonHeight))) continue;
      candidates.push(point);
    }
  }
  if (!candidates.length) return null;

  const edgeDistance = (point: Point) => Math.hypot(
    Math.max(point.x - pointer.x, 0, pointer.x - point.x - buttonWidth),
    Math.max(point.y - pointer.y, 0, pointer.y - point.y - buttonHeight),
  );
  const shortSteps = candidates.filter(point => Math.hypot(point.x - current.x, point.y - current.y) <= 72 + EPSILON);
  const local = shortSteps.length ? shortSteps : candidates;
  const initialCenterDistance = Math.hypot(dx, dy);
  const centerDistance = (point: Point) => Math.hypot(point.x + buttonWidth / 2 - pointer.x, point.y + buttonHeight / 2 - pointer.y);
  const farther = local.filter(point => centerDistance(point) > initialCenterDistance + 1);
  const choices = farther.length ? farther : local;
  const score = (point: Point) => {
    const moveX = point.x - current.x;
    const moveY = point.y - current.y;
    const forward = moveX * direction.x + moveY * direction.y;
    return forward * 1.2 + (edgeDistance(point) - edgeDistance(current)) * .75 + Math.hypot(moveX, moveY) * .2;
  };
  choices.sort((a, b) => score(b) - score(a));
  return choices[0];
}
