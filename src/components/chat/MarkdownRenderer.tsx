'use client';

import React from 'react';
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

function renderInline(text: string): React.ReactNode[] {
  // Handle bold, inline code, and regular text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-card-solid/60 text-accent text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
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

    // Table
    if (isTableRow(line)) {
      const tableRows: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }

      // Parse header, separator, and body
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

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-2">
          {listItems.map((item, li) => (
            <li key={li} className="flex gap-2.5 text-sm text-muted leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center mt-0.5">
                <span className="text-accent text-[10px] font-bold">{li + 1}</span>
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1 my-2">
          {listItems.map((item, li) => (
            <li key={li} className="flex gap-2 text-sm text-muted leading-relaxed">
              <span className="text-accent/40 mt-1.5 text-[6px]">●</span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
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
