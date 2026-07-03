const DEPLOY_NOTE_MARKERS = [
  /^Trading fees:/i,
  /^Trading fees on this token go to hood\.markets/i,
  /^Deployed via hoodmarkets by /i,
  /^real shit meme shit, no dev , no fees\./i,
] as const;

function isDeployBoilerplateParagraph(p: string): boolean {
  const t = p.trim();
  if (!t) return false;
  return DEPLOY_NOTE_MARKERS.some((re) => re.test(t));
}

/** Split catalog/on-chain description into user copy vs auto-appended deploy notes. */
export function splitTokenDescriptionForDisplay(raw?: string | null): {
  userText?: string;
  deployNotes?: string;
} {
  const text = raw?.trim();
  if (!text) return {};

  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const user: string[] = [];
  const system: string[] = [];

  for (const p of paragraphs) {
    if (isDeployBoilerplateParagraph(p)) system.push(p);
    else user.push(p);
  }

  return {
    ...(user.length ? { userText: user.join('\n\n') } : {}),
    ...(system.length ? { deployNotes: system.join(' ') } : {}),
  };
}
