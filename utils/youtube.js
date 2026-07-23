// Normalizes any pasted YouTube URL (watch, youtu.be short link, /shorts/,
// or an already-embed URL) down to a single canonical embed form so every
// FAQ consumer (admin preview, mybikeuser, mrbikeprovider) deals with one shape.
const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
];

function extractYoutubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function toYoutubeEmbedUrl(url) {
  const videoId = extractYoutubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

module.exports = { extractYoutubeVideoId, toYoutubeEmbedUrl };
