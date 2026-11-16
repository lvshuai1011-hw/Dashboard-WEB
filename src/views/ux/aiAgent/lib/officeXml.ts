export function officeFailure() {
  return new Error('INVALID_OFFICE_DOCUMENT');
}
export function officePath(base: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes('\\')) throw officeFailure();
  const segments: string[] = [];
  for (const part of (target.startsWith('/') ? target.slice(1) : base + target).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) throw officeFailure();
      segments.pop();
    } else segments.push(part);
  }
  return segments.join('/');
}
export function xmlElements(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name));
}
export function parseOfficeXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw officeFailure();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (xmlElements(doc, 'parsererror').length || !doc.documentElement) throw officeFailure();
  return doc;
}
