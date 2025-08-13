// 检测乱码
export function isGarbled(text) {
  if (!text) return false;
  const s = String(text);
  let weird = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    const isAsciiWord = (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || code === 32;
    const isCJK = (code >= 0x4e00 && code <= 0x9fff);
    if (!isAsciiWord && !isCJK) weird++;
  }
  return weird / s.length > 0.35;
}

// 尝试修复编码
export function tryFixEncoding(text) {
  if (!text) return '';
  const s = String(text);
  if (!isGarbled(s)) return s;
  try {
    const buf = Buffer.from(s, 'binary');
    return buf.toString('utf8');
  } catch {
    return s;
  }
}
