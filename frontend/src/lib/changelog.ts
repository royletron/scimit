// Parses CHANGELOG.md (Keep a Changelog style) into releases for the What's new page.
export interface Release {
  version: string;
  date?: string;
  sections: { title: string; items: string[] }[];
}

export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let section: Release['sections'][number] | undefined;

  for (const line of md.split('\n')) {
    const h2 = line.match(/^## \[?([^\]\s]+)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (h2) {
      release = { version: h2[1], date: h2[2], sections: [] };
      releases.push(release);
      section = undefined;
      continue;
    }
    if (!release) continue; // title and intro
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      section = { title: h3[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }
    const item = line.match(/^[-*] (.+)/);
    if (item) {
      if (!section) release.sections.push((section = { title: 'Changes', items: [] }));
      section.items.push(item[1].trim());
    } else if (/^\s{2,}\S/.test(line) && section?.items.length) {
      section.items[section.items.length - 1] += ` ${line.trim()}`; // wrapped bullet
    }
  }
  return releases;
}
