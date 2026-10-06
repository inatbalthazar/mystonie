import { assetLinks, parseFingerprints } from "@/core/android";

/**
 * Digital Asset Links for the Android app (ADR 0097): Chrome opens mystonie.com full screen in the app only when this
 * lists the fingerprints of the certificates that sign it (`ANDROID_CERT_SHA256`, not secret). Empty until then.
 */
export function GET() {
  return Response.json(assetLinks(parseFingerprints(process.env.ANDROID_CERT_SHA256)), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
