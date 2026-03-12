'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Parse follow-up suggestions from hidden comment
export function parseFollowups(content: string): { cleanContent: string; followups: string[] } {
  const match = content.match(/<!--FOLLOWUPS:\s*(.+?)\s*-->/);
  if (!match) return { cleanContent: content, followups: [] };

  const cleanContent = content.replace(/<!--FOLLOWUPS:\s*.+?\s*-->/, '').trimEnd();
  const followups = match[1].split('|').map(q => q.trim()).filter(Boolean);
  return { cleanContent, followups };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-muted/50 hover:text-foreground transition-colors p-1"
      title="Copy code"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

function renderInline(text: string): React.ReactNode[] {
  // Order: bold → inline code → links → italic → bare URLs → plain text
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|https?:\/\/[^\s<>)"]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    const m = match[0];
    const key = `m-${match.index}`;

    if (m.startsWith('**') && m.endsWith('**')) {
      parts.push(<strong key={key} className="text-foreground font-semibold">{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('`') && m.endsWith('`')) {
      parts.push(<code key={key} className="px-1.5 py-0.5 rounded bg-card-solid/60 text-accent text-xs font-mono">{m.slice(1, -1)}</code>);
    } else if (m.startsWith('[')) {
      const linkMatch = m.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch && /^https?:\/\//i.test(linkMatch[2])) {
        parts.push(
          <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(<span key={key}>{m}</span>);
      }
    } else if (m.startsWith('*') && m.endsWith('*') && !m.startsWith('**')) {
      parts.push(<em key={key} className="italic">{m.slice(1, -1)}</em>);
    } else if (m.startsWith('http')) {
      parts.push(
        <a key={key} href={m} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {m}
        </a>
      );
    } else {
      parts.push(<span key={key}>{m}</span>);
    }

    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [<span key="0">{text}</span>];
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line.trim().slice(1, -1).split('|').map(c => c.trim());
}

// Parse a list block (bullet or numbered), handling nesting up to 2 levels
function parseListBlock(lines: string[], startIdx: number): { items: { text: string; children: { text: string; ordered: boolean }[] }[]; endIdx: number; ordered: boolean } {
  const items: { text: string; children: { text: string; ordered: boolean }[] }[] = [];
  let i = startIdx;
  const firstLine = lines[i];
  const ordered = /^\d+\.\s/.test(firstLine);

  const isTopLevelItem = (line: string) => {
    if (ordered) return /^\d+\.\s/.test(line);
    return /^[-*]\s/.test(line);
  };

  const isNestedItem = (line: string) => /^(\s{2,})[-*]\s/.test(line) || /^(\s{2,})\d+\.\s/.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (!isTopLevelItem(line) && !isNestedItem(line)) break;

    if (isTopLevelItem(line)) {
      const text = ordered ? line.replace(/^\d+\.\s/, '') : line.slice(2);
      items.push({ text, children: [] });
      i++;
    } else if (isNestedItem(line) && items.length > 0) {
      const trimmed = line.trimStart();
      const childOrdered = /^\d+\.\s/.test(trimmed);
      const childText = childOrdered ? trimmed.replace(/^\d+\.\s/, '') : trimmed.slice(2);
      items[items.length - 1].children.push({ text: childText, ordered: childOrdered });
      i++;
    } else {
      break;
    }
  }

  return { items, endIdx: i, ordered };
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence

      const code = codeLines.join('\n');
      elements.push(
        <div key={`code-${i}`} className="my-3 rounded-lg overflow-hidden border border-border/30">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d0d0f] border-b border-border/20">
            <span className="text-[10px] text-muted/50 font-mono uppercase">{lang || 'code'}</span>
            <CopyButton text={code} />
          </div>
          <pre className="bg-[#0d0d0f] px-4 py-3 overflow-x-auto">
            <code className="text-xs font-mono text-foreground/80 leading-relaxed">{code}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Horizontal rules
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      elements.push(<hr key={`hr-${i}`} className="border-border/30 my-3" />);
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-2 first:mt-0">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2 first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`bq-${i}`} className="border-l-2 border-accent/40 pl-3 italic text-sm text-muted/80 my-2">
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="leading-relaxed">{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Table
    if (isTableRow(line)) {
      const tableRows: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }

      if (tableRows.length >= 2) {
        const headerCells = parseTableCells(tableRows[0]);
        const hasSeparator = tableRows.length >= 2 && isSeparatorRow(tableRows[1]);
        const bodyStart = hasSeparator ? 2 : 1;
        const bodyRows = tableRows.slice(bodyStart);

        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-3 rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card-solid/30 border-b border-border/50">
                  {headerCells.map((cell, ci) => (
                    <th key={ci} className="px-3 py-2 text-left text-xs font-medium text-muted">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {bodyRows.map((row, ri) => {
                  const cells = parseTableCells(row);
                  return (
                    <tr key={ri} className="hover:bg-card-solid/20">
                      {cells.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-muted">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Lists (bullet or numbered, with nesting)
    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const { items, endIdx, ordered } = parseListBlock(lines, i);
      i = endIdx;

      if (ordered) {
        elements.push(
          <ol key={`ol-${i}`} className="space-y-1.5 my-2">
            {items.map((item, li) => (
              <li key={li}>
                <div className="flex gap-2.5 text-sm text-muted leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
                    <span className="text-accent text-[10px] font-bold">{li + 1}</span>
                  </span>
                  <span className="flex-1">{renderInline(item.text)}</span>
                </div>
                {item.children.length > 0 && (
                  <ul className="ml-8 mt-1 space-y-1">
                    {item.children.map((child, ci) => (
                      <li key={ci} className="flex gap-2 text-sm text-muted leading-relaxed">
                        <span className="text-accent/40 mt-1.5 text-[6px]">●</span>
                        <span className="flex-1">{renderInline(child.text)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${i}`} className="space-y-1 my-2">
            {items.map((item, li) => (
              <li key={li}>
                <div className="flex gap-2 text-sm text-muted leading-relaxed">
                  <span className="text-accent/40 mt-1.5 text-[6px]">●</span>
                  <span className="flex-1">{renderInline(item.text)}</span>
                </div>
                {item.children.length > 0 && (
                  <ul className="ml-4 mt-1 space-y-1">
                    {item.children.map((child, ci) => (
                      <li key={ci} className="flex gap-2 text-sm text-muted leading-relaxed">
                        <span className="text-muted/30 mt-1.5 text-[6px]">●</span>
                        <span className="flex-1">{renderInline(child.text)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        );
      }
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-muted leading-relaxed my-1.5">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className={cn('space-y-0', className)}>{elements}</div>;
}
