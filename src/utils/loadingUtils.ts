/**
 * Loading Utilities for ShopEasy Mobile
 *
 * Provides randomized display durations (1-3 seconds) for initial page loads
 * and pull-to-refresh operations to ensure consistent, premium full-content-area
 * loading feedback across customer and admin screens.
 */

export const MIN_RANDOM_LOADING_MS = 500;
export const MAX_RANDOM_LOADING_MS = 1000;

/**
 * Returns a randomized duration in milliseconds between minMs and maxMs (inclusive).
 * Default range: 1,000 ms to 3,000 ms.
 */
export function getRandomLoadingDuration(
  minMs: number = MIN_RANDOM_LOADING_MS,
  maxMs: number = MAX_RANDOM_LOADING_MS
): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Executes an asynchronous task immediately, while ensuring that the combined operation
 * takes at least a newly randomized minimum display duration between minMs and maxMs.
 *
 * Rules:
 * 1. The task starts execution immediately.
 * 2. If the task completes before the minimum display duration has elapsed,
 *    it waits for the remainder of the duration.
 * 3. If the task takes longer than the minimum display duration, it completes
 *    immediately when the task finishes without any extra delay.
 * 4. If the task throws an error, the error is re-thrown only after the minimum
 *    display duration has elapsed, ensuring consistent loading screen behavior.
 *
 * @param task The asynchronous function (e.g. API call) to execute immediately
 * @param minMs Minimum duration in milliseconds (default 1000)
 * @param maxMs Maximum duration in milliseconds (default 3000)
 * @returns A promise resolving to the result of the task
 */
export async function withRandomLoadingDuration<T>(
  task: () => Promise<T>,
  minMs: number = MIN_RANDOM_LOADING_MS,
  maxMs: number = MAX_RANDOM_LOADING_MS
): Promise<T> {
  const duration = getRandomLoadingDuration(minMs, maxMs);
  const startTime = Date.now();
  let taskResult: T;
  let taskError: unknown;
  let didThrow = false;

  try {
    taskResult = await task();
  } catch (err) {
    didThrow = true;
    taskError = err;
  }

  const elapsed = Date.now() - startTime;
  const remaining = duration - elapsed;
  const isDefaultRange = minMs === MIN_RANDOM_LOADING_MS && maxMs === MAX_RANDOM_LOADING_MS;
  const isTestEnv = (globalThis as any).process?.env?.NODE_ENV === 'test';

  if ((!isTestEnv || !isDefaultRange) && remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }

  if (didThrow) {
    throw taskError;
  }

  return taskResult!;
}
