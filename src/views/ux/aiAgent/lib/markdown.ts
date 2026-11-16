import type { ComposerTranslation } from "../types";

export function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, char => entities[char]);
}
export function safeUrl(value: string) {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? escapeHtml(url.href) : ''; }
  catch { return ''; }
}
export function inlineMarkdown(value: string) {
  // 在原文上识别 token，所有普通文本/属性分别转义，不二次解析已生成的 HTML。
  const pattern = /`([^`]+)`|\[([^\]\n]+)\]\(([^\s()]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let result = '', offset = 0;
  for (const match of value.matchAll(pattern)) {
    result += escapeHtml(value.slice(offset, match.index));
    const [, code, label, url, bold, italic] = match;
    const href = url ? safeUrl(url) : '';
    result += code !== undefined ? `<code>${escapeHtml(code)}</code>` : label !== undefined
      ? href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(match[0])
      : bold !== undefined ? `<strong>${escapeHtml(bold)}</strong>` : `<em>${escapeHtml(italic)}</em>`;
    offset = match.index! + match[0].length;
  }
  return result + escapeHtml(value.slice(offset));
}
export function detailsEnd(value: string): number {
  let depth = 0;
  for (const match of value.matchAll(/<details(?: open)?>|<\/details>/g)) {
    depth += match[0] === '</details>' ? -1 : 1;
    if (depth === 0) return match.index! + match[0].length;
  }
  return -1;
}
// 轻量语法着色：只区分注释、字符串、数字、关键字四类，不引入高亮库；未标注语言或纯文本时原样输出。
export const CODE_KEYWORDS = new Set('const let var function return if else for while do break continue switch case default new class extends import export from async await try catch finally throw typeof instanceof in of null undefined true false this super void delete yield static public private protected interface enum implements package def lambda pass None True False and or not elif except raise with global nonlocal func go defer chan struct range fn mut impl pub self final abstract then fi done esac'.split(' '));
export const SQL_KEYWORDS = new Set('select insert update delete into values from where group by order having join left right inner outer on as and or not in is null limit offset union all distinct create table alter drop index view set desc asc between like exists case when then else end with count sum avg min max'.split(' '));
export const CODE_PLAIN = /^(?:|text|txt|plain|plaintext|log|output|csv|markdown|md)$/;
export const CODE_HASH = /^(?:py|python|sh|bash|shell|zsh|yaml|yml|toml|ruby|rb|ini|conf|dockerfile|makefile|r|perl|powershell|ps1)$/;
export function highlightCode(code: string, language: string): string {
  const lang = language.trim().toLowerCase().split(/\s+/)[0] ?? '';
  if (CODE_PLAIN.test(lang) || code.length > 20000) return escapeHtml(code);
  const comment = CODE_HASH.test(lang) ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' : lang === 'json' ? '(?!)' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const pattern = new RegExp(`(${comment})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_]\\w*)\\b`, 'g');
  let html = '', last = 0;
  for (const match of code.matchAll(pattern)) {
    const [text, isComment, isString, isNumber, word] = match;
    const kind = isComment ? 'c' : isString ? 's' : isNumber ? 'n' : word && (lang === 'sql' ? SQL_KEYWORDS.has(word.toLowerCase()) : CODE_KEYWORDS.has(word)) ? 'k' : '';
    if (!kind) continue;
    html += `${escapeHtml(code.slice(last, match.index))}<span class="tok-${kind}">${escapeHtml(text)}</span>`;
    last = match.index! + text.length;
  }
  return html + escapeHtml(code.slice(last));
}
export const CHECK_ICON = '<svg class="copy-done" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
export const COPY_ICON = '<svg class="copy-idle" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/></svg>';
export function renderMarkdown(source: string, t: ComposerTranslation, depth = 0): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];
  const cells = (line: string) => {
    const values: string[] = []; let value = '', code = false;
    const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let k = 0; k < row.length; k++) {
      if (row[k] === '\\' && row[k + 1] === '|') { value += '|'; k++; continue; }
      if (row[k] === '`') code = !code;
      if (row[k] === '|' && !code) { values.push(value.trim()); value = ''; } else value += row[k];
    }
    values.push(value.trim()); return values;
  };
  const separator = (line: string) => line.includes('|') && cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const code: string[] = []; i++;
      const closing = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
      while (i < lines.length && !closing.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = `<pre><code>${highlightCode(code.join('\n'), fence[2])}</code></pre>`;
      result.push(`<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(fence[2].trim() || t('AIAGENT.MARKDOWN.CODE'))}</span>`
        + `<button type="button" data-copy-code title="${escapeHtml(t('AIAGENT.BUTTON.COPY_CODE'))}" aria-label="${escapeHtml(t('AIAGENT.BUTTON.COPY_CODE'))}">${COPY_ICON}${CHECK_ICON}</button></div>`
        + (code.length > 14 ? `<details class="code-fold"><summary>${escapeHtml(t('AIAGENT.MARKDOWN.EXPAND_CODE', { lines: code.length }))}</summary>${pre}</details>` : pre) + '</div>');
      continue;
    }
    // 只接受无任意属性的 details/summary 子集，重新生成安全标签；其它原始 HTML 一律转义。
    if (depth < 4 && /^<details(?: open)?>$/.test(line.trim())) {
      const rest = lines.slice(i).join('\n'), end = detailsEnd(rest);
      if (end > 0 && !rest.slice(end).split('\n')[0].trim()) {
        const block = rest.slice(0, end), body = block.replace(/^<details(?: open)?>\s*/, '').replace(/<\/details>$/, '');
        const summary = /^<summary>([\s\S]*?)<\/summary>\s*/.exec(body);
        result.push(`<details class="md-details"><summary>${inlineMarkdown(summary?.[1] || t('AIAGENT.PROCESS.DETAILS'))}</summary>${renderMarkdown(body.slice(summary?.[0].length || 0), t, depth + 1)}</details>`);
        i += block.split('\n').length; continue;
      }
    }
    if (i + 1 < lines.length && line.includes('|') && separator(lines[i + 1])) {
      const headers = cells(line), rows: string[] = []; i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const row = cells(lines[i++]); rows.push(`<tr>${headers.map((_, index) => `<td>${inlineMarkdown(row[index] ?? '')}</td>`).join('')}</tr>`);
      }
      result.push(`<div class="table-scroll"><table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { result.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); i++; continue; }
    const list = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[1]), tag = ordered ? 'ol' : 'ul', items: string[] = [];
      while (i < lines.length) {
        const item = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(lines[i]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(`<li>${inlineMarkdown(item[2])}</li>`); i++;
      }
      result.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    result.push(/^>\s?/.test(line) ? `<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>` : `<p>${inlineMarkdown(line)}</p>`);
    i++;
  }
  return result.join('');
}
// 逐次取最多 15 个 Unicode 字符，完整 details 作为一个原子块；不切割生成的 HTML。
export function typingChunk(pending: string): string {
  let offset = 0, count = 0;
  while (offset < pending.length && count < 15) {
    const rest = pending.slice(offset);
    if (/^<details(?: open)?>/.test(rest)) {
      if (offset) break;
      const end = detailsEnd(rest); return end < 0 ? '' : rest.slice(0, end);
    }
    if (rest.startsWith('<') && ['<details>', '<details open>'].some(prefix => prefix.startsWith(rest))) break;
    const character = String.fromCodePoint(pending.codePointAt(offset)!); offset += character.length; count++;
  }
  return pending.slice(0, offset);
}
