import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Safe, zero-dangerouslySetInnerHTML Markdown renderer tailored for
 * Zi Wei Dou Shu interpretations (supports headings, **[Section]** headers,
 * bold **text**, italic *text*, inline `code`, bullet lists •/-/*, and numbered lists).
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Normalize any spaced bold markers like "** [Text] **" or "** text **"
  const normalized = text
    .replace(/\*\*\s+\[/g, '**[')
    .replace(/\]\s+\*\*/g, ']**');

  const tokens: React.ReactNode[] = [];
  // Match **bold**, *italic*, or `code`
  const pattern = /(\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      const plain = normalized.slice(lastIndex, match.index).replace(/\*\*/g, '');
      if (plain) tokens.push(<React.Fragment key={key++}>{plain}</React.Fragment>);
    }

    if (match[2] !== undefined) {
      const inner = match[2].trim();
      tokens.push(
        <strong key={key++} className="font-semibold text-amber-200">
          {inner}
        </strong>
      );
    } else if (match[3] !== undefined) {
      tokens.push(
        <em key={key++} className="italic text-[var(--t-text2)]">
          {match[3].trim()}
        </em>
      );
    } else if (match[4] !== undefined) {
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-[var(--t-bg)] border border-[var(--t-border)] text-[var(--t-gold)] font-mono text-[0.9em]"
        >
          {match[4]}
        </code>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < normalized.length) {
    // Strip any trailing/unmatched ** (e.g., while streaming)
    const tail = normalized.slice(lastIndex).replace(/\*\*/g, '');
    if (tail) tokens.push(<React.Fragment key={key++}>{tail}</React.Fragment>);
  }

  return tokens;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Horizontal Rule: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(<hr key={blockKey++} className="border-[var(--t-border)] my-3" />);
      i++;
      continue;
    }

    // 2. Standard Markdown Headings: # / ## / ### / ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const titleText = headingMatch[2].replace(/^\*\*|\*\*$/g, '').trim();
      if (level <= 2) {
        blocks.push(
          <h3
            key={blockKey++}
            className="text-sm sm:text-base font-bold text-[var(--t-gold)] pt-2 pb-1 border-b border-[var(--t-border)]/60 flex items-center gap-2"
          >
            <span className="w-1.5 h-4 rounded-full bg-[var(--t-gold)] shrink-0" />
            <span>{renderInlineMarkdown(titleText)}</span>
          </h3>
        );
      } else {
        blocks.push(
          <h4
            key={blockKey++}
            className="text-xs sm:text-sm font-bold text-[var(--t-gold)] pt-2 pb-0.5 flex items-center gap-2"
          >
            <span className="w-1 h-3.5 rounded-full bg-[var(--t-gold)]/80 shrink-0" />
            <span>{renderInlineMarkdown(titleText)}</span>
          </h4>
        );
      }
      i++;
      continue;
    }

    // 3. Standalone Bracketed / Bold Heading Line:
    // e.g. "**【Định Tính Mệnh Cách】**", "** [Định Tính Mệnh Cách] **", "**[Định Tính Mệnh Cách]**",
    // or a standalone bold title line "**1. Cấu Trúc Chính Tinh**" without trailing colon/prose
    const bracketHeaderMatch = trimmed.match(
      /^(?:\*\*\s*)?[【\[]([^】\]]+)[】\]](?:\s*\*\*)?$/
    );
    const fullBoldHeaderMatch =
      !bracketHeaderMatch && trimmed.length <= 90
        ? trimmed.match(/^\*\*([^*]+)\*\*$/)
        : null;

    if (bracketHeaderMatch || fullBoldHeaderMatch) {
      const rawTitle = bracketHeaderMatch
        ? bracketHeaderMatch[1].trim()
        : fullBoldHeaderMatch![1].replace(/^[【\[]|[】\]]$/g, '').trim();

      blocks.push(
        <h4
          key={blockKey++}
          className="text-xs sm:text-sm font-bold text-[var(--t-gold)] pt-2.5 first:pt-0 pb-0.5 flex items-center gap-2"
        >
          <span className="w-1 h-3.5 rounded-full bg-[var(--t-gold)] shrink-0" />
          <span>{rawTitle}</span>
        </h4>
      );
      i++;
      continue;
    }

    // 4. Unordered List: lines starting with •, -, or * (followed by space)
    if (/^([•\-*])\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^([•\-*])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([•\-*])\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={blockKey++} className="space-y-1.5 my-1.5 pl-1">
          {items.map((itemText, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[var(--t-gold)] font-bold mt-0.5 shrink-0 select-none">
                •
              </span>
              <span className="flex-1 text-[var(--t-text)]">
                {renderInlineMarkdown(itemText)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 5. Ordered List: lines starting with "1. ", "2. ", etc.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const m = lines[i].trim().match(/^(\d+)\.\s+(.+)$/);
        if (m) {
          items.push({ num: m[1], text: m[2] });
        }
        i++;
      }
      blocks.push(
        <ol key={blockKey++} className="space-y-1.5 my-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[var(--t-gold)] font-semibold shrink-0 select-none">
                {item.num}.
              </span>
              <span className="flex-1 text-[var(--t-text)]">
                {renderInlineMarkdown(item.text)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 6. Standard Paragraph
    blocks.push(
      <p key={blockKey++} className="text-[var(--t-text)] leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-2 ${className}`.trim()}>{blocks}</div>;
}
