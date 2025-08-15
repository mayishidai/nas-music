import { normalizeTextBasic, stripDecorations } from './textUtils.js';

// 计算字符串相似度（编辑距离）
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // 编辑距离计算
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}

// Jaccard 相似度计算
export function jaccardTokens(a, b) {
  const as = new Set(normalizeTextBasic(a).split(' ').filter(Boolean));
  const bs = new Set(normalizeTextBasic(b).split(' ').filter(Boolean));
  if (as.size === 0 || bs.size === 0) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  return inter / (as.size + bs.size - inter);
}

// 标题相似度计算
export function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = stripDecorations(a);
  const nb = stripDecorations(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return jaccardTokens(na, nb);
}

// 艺术家相似度计算
export function artistSimilarity(a, b) {
  if (!a || !b) return 0;
  return jaccardTokens(a, b);
}

// 年份相似度计算
export function yearSimilarity(a, b) {
  if (!a || !b) return 0;
  const ya = parseInt(a);
  const yb = parseInt(b);
  if (isNaN(ya) || isNaN(yb)) return 0;
  const diff = Math.abs(ya - yb);
  if (diff === 0) return 1;
  if (diff <= 1) return 0.9;
  if (diff <= 2) return 0.8;
  if (diff <= 5) return 0.6;
  return Math.max(0, 1 - diff / 10);
}

// 时长相似度计算
export function durationSimilarity(a, b) {
  if (!a || !b) return 0;
  const da = parseFloat(a);
  const db = parseFloat(b);
  if (isNaN(da) || isNaN(db)) return 0;
  const diff = Math.abs(da - db);
  const avg = (da + db) / 2;
  if (avg === 0) return 1;
  const ratio = diff / avg;
  if (ratio <= 0.05) return 1;
  if (ratio <= 0.1) return 0.9;
  if (ratio <= 0.2) return 0.7;
  return Math.max(0, 1 - ratio);
}

// 简化的年份相似度计算
export function yearSimilaritySimple(a, b) {
  const ya = parseInt(a, 10);
  const yb = parseInt(b, 10);
  if (!ya || !yb) return 0;
  if (Math.abs(ya - yb) <= 1) return 1;
  if (Math.abs(ya - yb) <= 2) return 0.7;
  return 0;
}

// 简化的时长相似度计算
export function durationSimilaritySimple(a, b) {
  const da = Number(a);
  const db = Number(b);
  if (!da || !db) return 0;
  const diff = Math.abs(da - db);
  if (diff <= 2) return 1;
  if (diff <= 5) return 0.8;
  if (diff <= 10) return 0.6;
  if (diff <= 20) return 0.3;
  return 0;
}

// 简化的相似度计算
export function similarity(a, b) {
  const na = normalizeTextBasic(a);
  const nb = normalizeTextBasic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // 简化的包含度评分
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}
