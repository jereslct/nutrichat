/**
 * Wrapper around fetch() that aborts the request if it exceeds the given timeout.
 * Prevents Edge Functions from hanging indefinitely when external services
 * (Lovable AI Gateway, MercadoPago API, etc.) are slow or unresponsive.
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 10_000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `La solicitud a ${typeof url === "string" ? url : url.toString()} excedió el tiempo límite de ${timeout / 1000}s`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
