/**
 * Runs an async generator to completion in the background and returns a reader for its
 * events. If the reader stops early (the browser tab closed, the user pressed Stop), the
 * work still finishes — important for agent runs, which must not be cut off halfway through
 * a tool call. `settled` resolves when the background work is done (pass it to `after()`).
 */
export function detach<T>(source: AsyncGenerator<T>, onSettled?: () => Promise<void> | void) {
  const buffer: T[] = [];
  let finished = false;
  let failure: unknown;
  // Held in an object so TypeScript doesn't narrow it to `null` inside the closures below.
  const waiter: { wake?: () => void } = {};

  const settled = (async () => {
    try {
      for await (const item of source) {
        buffer.push(item);
        waiter.wake?.();
      }
    } catch (err) {
      failure = err;
    } finally {
      finished = true;
      waiter.wake?.();
      await onSettled?.();
    }
  })();

  async function* events(): AsyncGenerator<T> {
    for (;;) {
      if (buffer.length) {
        yield buffer.shift()!;
        continue;
      }
      if (finished) {
        if (failure) throw failure;
        return;
      }
      await new Promise<void>((resolve) => (waiter.wake = resolve));
      waiter.wake = undefined;
    }
  }

  return { events: events(), settled };
}
