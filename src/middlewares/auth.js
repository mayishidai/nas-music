

//定义需要权限的路径
const matchs = [
  '/api/*',
]

function antPatternToRegex(pattern) {
  let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  regexStr = regexStr
    .replace(/\?/g, '[^/]')        // ? → 匹配单个非斜杠字符
    .replace(/\*\*/g, '.*')        // ​**​ → 匹配多级路径
    .replace(/\*/g, '[^/]*');     // * → 匹配单级路径中的任意字符
  if (!regexStr.startsWith('^')) regexStr = '^' + regexStr;
  if (!regexStr.endsWith('$')) regexStr += '$';
  return new RegExp(regexStr);
}

function isPathMatched(path, patterns) {
  const compiledPatterns = patterns.map(p => ({
    regex: antPatternToRegex(p),
    original: p
  }));
  compiledPatterns.sort((a, b) => b.original.length - a.original.length);
  return compiledPatterns.some(({ regex }) => regex.test(path));
}

export default async(ctx, next) => {
  const requiresAuth = isPathMatched(ctx.path, matchs)
  if(!requiresAuth){ return await next() }
  //TODO 判断登录和权限
  await next()
}