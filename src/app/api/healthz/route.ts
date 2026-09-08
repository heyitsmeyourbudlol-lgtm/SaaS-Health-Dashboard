export async function GET(request: Request) {
  const url = new URL(request.url);
  const pattern = url.searchParams.get("pattern") ?? "default";

  // Deterministic, time-varying failure simulation.
  // We want demo uptime checks to work without external DNS, while still
  // producing intermediate uptime (some targets occasionally fail).
  const windowMs = 60_000; // 1-minute buckets
  const bucket = Math.floor(Date.now() / windowMs);

  const baseFailureRate = failureRateFromPattern(pattern); // 0.0 - ~0.12
  const jitter = (hashInt(`${pattern}:${bucket}`) % 10_000) / 10_000; // 0 - 1

  // If jitter falls under failure rate, this endpoint is "down".
  const isDown = jitter < baseFailureRate;

  // Simulate a bit of real-world latency.
  await new Promise((r) => setTimeout(r, 60));

  if (isDown) {
    return new Response(
      JSON.stringify({ ok: false, pattern, bucket, down: true }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, pattern, bucket, down: false }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function failureRateFromPattern(pattern: string): number {
  // Turn the string into a small stable baseline failure rate so different
  // clients behave differently even in demo mode.
  // Produces roughly 0.05%..2.0%.
  const h = hashInt(pattern);
  const x = (Math.abs(h) % 10_000) / 10_000; // 0..1
  return 0.0005 + x * 0.02;
}

function hashInt(input: string): number {
  // Simple non-crypto hash; deterministic and fast.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash;
}

