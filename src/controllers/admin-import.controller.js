// Helpers for importing a novel (see the frontend's utils/novelUpdatesImport.js).
// The NovelUpdates page itself is read by the admin's browser; only cover
// images are fetched here, because the browser can't read cross-origin
// image bytes.

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const DOWNLOAD_FAILED = "Couldn't download the cover — upload it manually";

const hostMatches = (value, pattern) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && pattern.test(url.hostname);
  } catch {
    return false;
  }
};

const NOVELUPDATES = /(^|\.)novelupdates\.com$/i;
const WUXIAWORLD_CDN = /^cdn\.wuxiaworld\.com$/i;

// Downloads an image, refusing anything that ends up off `allowedHost`
// (after redirects), isn't an image, or is too large. Returns null on failure.
const downloadImage = async (url, allowedHost) => {
  const upstream = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !hostMatches(upstream.url, allowedHost) || !type.startsWith("image/")) return null;
  const bytes = Buffer.from(await upstream.arrayBuffer());
  return bytes.length > MAX_BYTES ? null : { type, bytes };
};

const sendImage = (res, image) => {
  res.set("Content-Type", image.type);
  return res.status(200).send(image.bytes);
};

// GET /api/admin/import/cover?url=https://cdn.novelupdates.com/images/...
const fetchCover = async (req, res) => {
  const { url } = req.query;
  if (typeof url !== "string" || !hostMatches(url, NOVELUPDATES)) {
    return res.status(400).json({ message: "Only NovelUpdates image URLs are allowed" });
  }
  try {
    const image = await downloadImage(url, NOVELUPDATES);
    return image ? sendImage(res, image) : res.status(502).json({ message: DOWNLOAD_FAILED });
  } catch (error) {
    console.log("Cover import failed:", error.message);
    return res.status(502).json({ message: DOWNLOAD_FAILED });
  }
};

// "Against the Gods" → "against-the-gods", "Emperor's Domination" → "emperors-domination"
const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Slug from a pasted https://www.wuxiaworld.com/novel/<slug>[/...] link.
const slugFromUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^(www\.)?wuxiaworld\.com$/i.test(url.hostname)) return null;
    return /^\/novel\/([a-z0-9-]+)/i.exec(url.pathname)?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
};

const OG_IMAGE = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i;

// GET /api/admin/import/wuxiaworld-cover?title=Against the Gods
//  or ?url=https://www.wuxiaworld.com/novel/against-the-gods
// Wuxiaworld novel pages name their cover in og:image; pages that don't exist
// have none, so a wrong guess from the title is a clean 404.
const fetchWuxiaworldCover = async (req, res) => {
  const { title, url } = req.query;
  const slug =
    typeof url === "string" && url ? slugFromUrl(url) : typeof title === "string" ? slugify(title) : null;
  if (!slug) {
    return res.status(400).json({ message: "Paste a Wuxiaworld novel link, like wuxiaworld.com/novel/against-the-gods" });
  }
  try {
    const page = await fetch(`https://www.wuxiaworld.com/novel/${slug}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const coverUrl = page.ok ? OG_IMAGE.exec(await page.text())?.[1]?.replace(/&amp;/g, "&") : null;
    if (!coverUrl || !hostMatches(coverUrl, WUXIAWORLD_CDN)) {
      return res.status(404).json({ message: "Not found on Wuxiaworld" });
    }
    const image = await downloadImage(coverUrl, WUXIAWORLD_CDN);
    return image ? sendImage(res, image) : res.status(502).json({ message: DOWNLOAD_FAILED });
  } catch (error) {
    console.log("Wuxiaworld cover import failed:", error.message);
    return res.status(502).json({ message: DOWNLOAD_FAILED });
  }
};

export { fetchCover, fetchWuxiaworldCover };
