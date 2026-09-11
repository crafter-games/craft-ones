export const dynamic = "force-static";

export function GET() {
  return Response.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  });
}
