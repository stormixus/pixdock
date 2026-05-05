export function spark(offset: number, length: number, base: number, variance: number) {
  const arr = [];
  for (let i = 0; i < length; i++) {
    const v = Math.sin((offset + i) * 0.5) * variance + base + Math.random() * 0.1;
    arr.push(Math.max(0, v));
  }
  return arr;
}

export function fmtClock(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function stateLed(state: string): string {
  if (state === 'running') return 'green';
  if (state === 'exited' || state === 'dead') return 'red';
  return 'yellow';
}

export function createTicker(intervalMs = 1500) {
  let tick = $state(0);
  let id: ReturnType<typeof setInterval>;

  $effect(() => {
    id = setInterval(() => tick++, intervalMs);
    return () => clearInterval(id);
  });

  return {
    get value() {
      return tick;
    }
  };
}

export function createClock() {
  let now = $state(new Date());
  let id: ReturnType<typeof setInterval>;

  $effect(() => {
    id = setInterval(() => {
      now = new Date();
    }, 1000);
    return () => clearInterval(id);
  });

  return {
    get value() {
      return now;
    }
  };
}
