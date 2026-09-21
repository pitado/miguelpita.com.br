import { DurableObject } from "cloudflare:workers";

const NOTE_SLUG = /^[a-z0-9_-]{1,48}$/;
const MAX_NOTE_BYTES = 100000;

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function noteSlugFromPath(pathname) {
  const prefix = "/api/notes/";
  if (!pathname.startsWith(prefix)) return null;

  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes("/")) return null;

  let slug;
  try {
    slug = decodeURIComponent(raw);
  }
  catch {
    return null;
  }

  return NOTE_SLUG.test(slug) ? slug : null;
}

function isSameOriginWrite(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  }
  catch {
    return false;
  }
}

export class NotesStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async fetch(request) {
    if (request.method === "GET") {
      const stored = await this.ctx.storage.get("note");

      if (!stored) {
        return json({ error: "Note not found.", code: "NOTE_NOT_FOUND" }, 404);
      }

      return json({
        content: typeof stored.content === "string" ? stored.content : "",
        updatedAt: stored.updatedAt || null
      });
    }

    if (request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      }
      catch {
        return json({ error: "Invalid JSON." }, 400);
      }

      if (!body || typeof body.content !== "string") {
        return json({ error: "content must be a string." }, 400);
      }

      const byteLength = new TextEncoder().encode(body.content).byteLength;
      if (byteLength > MAX_NOTE_BYTES) {
        return json({ error: "Note is too large.", maxBytes: MAX_NOTE_BYTES }, 413);
      }

      const updatedAt = new Date().toISOString();

      await this.ctx.storage.put("note", {
        content: body.content,
        updatedAt
      });

      return json({ ok: true, updatedAt });
    }

    if (request.method === "DELETE") {
      await this.ctx.storage.delete("note");
      return json({ ok: true });
    }

    return json(
      { error: "Method not allowed." },
      405,
      { "Allow": "GET, PUT, DELETE" }
    );
  }
}

async function handleNotesApi(request, env, slug) {
  if (!env.NOTES || typeof env.NOTES.getByName !== "function") {
    return json(
      {
        error: "Notes storage is not configured.",
        code: "NOTES_STORAGE_UNAVAILABLE"
      },
      503
    );
  }

  if (
    (request.method === "PUT" || request.method === "DELETE") &&
    !isSameOriginWrite(request)
  ) {
    return json({ error: "Cross-origin write blocked." }, 403);
  }

  const stub = env.NOTES.getByName(slug);
  return stub.fetch(request);
}

function notesPageRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/notes" || url.pathname === "/notes/") {
    url.pathname = "/notes/index.html";
    return new Request(url, request);
  }

  const match = url.pathname.match(/^\/notes\/([a-z0-9_-]{1,48})\/?$/);
  if (!match) return null;

  url.pathname = "/notes/index.html";
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = noteSlugFromPath(url.pathname);

    if (url.pathname.startsWith("/api/notes/")) {
      if (!slug) {
        return json({ error: "Invalid note name." }, 400);
      }

      return handleNotesApi(request, env, slug);
    }

    const notePage = notesPageRequest(request);
    if (notePage && (request.method === "GET" || request.method === "HEAD")) {
      return env.ASSETS.fetch(notePage);
    }

    return env.ASSETS.fetch(request);
  }
};
