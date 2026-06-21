import type { NDKEvent } from '@nostr-dev-kit/ndk';

const URL_RE = /https?:\/\/\S+/g;

function stripUrls(text: string): string {
  return text.replace(URL_RE, '').trim();
}

function countUrls(text: string): number {
  return (text.match(URL_RE) ?? []).length;
}

function hashtagCount(event: NDKEvent): number {
  return event.tags.filter(t => t[0] === 't').length;
}

export function isSpam(event: NDKEvent): boolean {
  const content = event.content ?? '';

  // Hashtag stuffing
  if (hashtagCount(event) >= 6) return true;

  // More than 3 URLs in a single note
  if (countUrls(content) > 3) return true;

  // Link-only post: content is a single URL with no surrounding text
  const withoutUrls = stripUrls(content);
  const urls = countUrls(content);
  if (urls >= 1 && withoutUrls.length === 0) return true;

  // Very short notes that are pure punctuation/emoji after stripping
  // (length < 3 non-whitespace chars and no URLs)
  if (urls === 0 && withoutUrls.replace(/\s+/g, '').length < 2) return true;

  return false;
}
