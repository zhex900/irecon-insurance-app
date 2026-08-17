/**
 * One-shot helper Worker: copy staging R2 objects into a preview bucket,
 * or empty a preview bucket so it can be deleted.
 *
 * Invoked by scripts/lib/preview-cloudflare.mjs. Not part of the app graph.
 */
const BATCH = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token =
      request.headers.get("x-copy-token") ?? url.searchParams.get("token");
    if (!env.COPY_TOKEN || token !== env.COPY_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const mode = url.searchParams.get("mode") ?? "copy";
    const bucket = url.searchParams.get("bucket");
    const cursor = url.searchParams.get("cursor") || undefined;
    const pair = resolvePair(env, bucket);
    if (!pair) {
      return Response.json(
        { error: `Unknown or unbound bucket "${bucket}"` },
        { status: 400 },
      );
    }

    if (mode === "empty") {
      if (!pair.dest) {
        return Response.json({ error: "dest bucket unbound" }, { status: 400 });
      }
      return Response.json(await emptyPage(pair.dest, cursor));
    }

    if (!pair.src || !pair.dest) {
      return Response.json({ error: "src/dest unbound" }, { status: 400 });
    }
    return Response.json(await copyPage(pair.src, pair.dest, cursor));
  },
};

function resolvePair(env, bucket) {
  if (bucket === "avatars") {
    return { src: env.AVATARS_SRC, dest: env.AVATARS_DEST };
  }
  if (bucket === "library") {
    return { src: env.LIBRARY_SRC, dest: env.LIBRARY_DEST };
  }
  return null;
}

async function copyPage(src, dest, cursor) {
  const listed = await src.list({ cursor, limit: BATCH });
  let copied = 0;
  for (const object of listed.objects) {
    const value = await src.get(object.key);
    if (!value) continue;
    await dest.put(object.key, value.body, {
      httpMetadata: value.httpMetadata,
      customMetadata: value.customMetadata,
    });
    copied += 1;
  }
  return {
    copied,
    cursor: listed.truncated ? listed.cursor : null,
    done: !listed.truncated,
  };
}

async function emptyPage(bucket, cursor) {
  const listed = await bucket.list({ cursor, limit: BATCH });
  await Promise.all(listed.objects.map((object) => bucket.delete(object.key)));
  return {
    deleted: listed.objects.length,
    cursor: listed.truncated ? listed.cursor : null,
    done: !listed.truncated,
  };
}
