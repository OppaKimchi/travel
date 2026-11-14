import { findLinks } from "../lib/links";

export function NoteLinks({ text }: { text: string }) {
  const links = findLinks(text);
  if (!links.length) return null;
  return (
    <ul className="note-links" aria-label="Links in the notes">
      {links.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
