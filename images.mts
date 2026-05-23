import { getStore } from "@netlify/blobs";

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const store = getStore("gallery-images");

  if (req.method === "GET") {
    const key = url.searchParams.get("key");

    if (key) {
      const meta = await store.getMetadata(key);
      if (!meta) {
        return new Response("Not found", { status: 404 });
      }
      const blob = await store.get(key, { type: "blob" });
      if (!blob) {
        return new Response("Not found", { status: 404 });
      }
      const contentType = (meta.metadata?.contentType as string) ?? "image/jpeg";
      return new Response(blob, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const gallery = url.searchParams.get("gallery");
    if (!gallery) {
      return new Response("Missing gallery or key parameter", { status: 400 });
    }

    const { blobs } = await store.list({ prefix: gallery + "/" });
    return Response.json(blobs.map((b) => ({ key: b.key })), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (req.method === "POST") {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return new Response("Invalid form data", { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const gallery = formData.get("gallery") as string | null;

    if (!file || !gallery) {
      return new Response("Missing file or gallery", { status: 400 });
    }

    const uuid = crypto.randomUUID();
    const key = `${gallery}/${uuid}`;

    await store.set(key, await file.arrayBuffer(), {
      metadata: { contentType: file.type || "image/jpeg", gallery },
    });

    return Response.json({ key });
  }

  if (req.method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response("Missing key parameter", { status: 400 });
    }
    await store.delete(key);
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/images",
};
