import { app as apiApp } from "@api/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleApiRequest(request: Request) {
  return apiApp.handle(request);
}

export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PATCH = handleApiRequest;
export const PUT = handleApiRequest;
export const DELETE = handleApiRequest;
export const OPTIONS = handleApiRequest;
