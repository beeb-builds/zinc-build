import "server-only";

// An explicit deployment origin avoids trusting client-supplied proxy headers.
export function appOrigin(request: { url: string }): string {
  const configured = process.env.ZINC_PUBLIC_ORIGIN;
  if (!configured) return new URL(request.url).origin;
  const url = new URL(configured);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
    (configured !== url.origin && configured !== `${url.origin}/`)) {
    throw new Error("ZINC_PUBLIC_ORIGIN must be an HTTP(S) origin without a path.");
  }
  return url.origin;
}
