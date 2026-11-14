export type NoteLink = { label: string; url: string };

// Finds web links in notes so they can be tapped. A line like
// "Instagram: https://..." uses its own label; other links use the site name.
export function findLinks(text: string): NoteLink[] {
  const links: NoteLink[] = [];
  for (const line of text.split("\n")) {
    for (const match of line.matchAll(/https?:\/\/[^\s<>"']+/g)) {
      const url = match[0].replace(/[.,;)]+$/, "");
      let label = "";
      const prefix = line.slice(0, match.index).trim().match(/^([^:]{1,30}):$/);
      if (prefix) label = prefix[1];
      if (!label) {
        try {
          label = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          continue;
        }
      }
      links.push({ label, url });
    }
  }
  return links;
}
