// The one place a Vimeo player URL is built. Videos are private and domain-locked, so the ID is
// the only thing that varies; anything that is not a plain numeric ID is refused.

const VIMEO_ID = /^[1-9]\d{0,14}$/;

export function vimeoPlayerUrl(id: string): string | null {
  if (!VIMEO_ID.test(id)) return null;
  return `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0`;
}
