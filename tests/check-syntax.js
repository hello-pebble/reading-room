// 문법 검사: frontend/*.html 안의 인라인 <script>와 frontend/js/*.js가 문법 오류 없이 컴파일되는지 본다. (의존성 없음)
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'frontend'), jsDir = path.join(dir, 'js');
let bad = 0, n = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => {
    n++;
    try { new vm.Script(m[1], { filename: `${f}#script${i}` }); }
    catch (e) { bad++; console.error(`문법 오류 ${f} (스크립트 ${i}): ${e.message}`); }
  });
}
for (const f of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {   // 분리한 스크립트 파일 (vendor/ 폴더는 보지 않는다)
  n++;
  try { new vm.Script(fs.readFileSync(path.join(jsDir, f), 'utf8'), { filename: f }); }
  catch (e) { bad++; console.error(`문법 오류 ${f}: ${e.message}`); }
}
if (!n) { console.error('검사할 스크립트를 찾지 못했어요'); process.exit(1); }
if (bad) process.exit(1);
console.log(`문법 검사 통과 (스크립트 ${n}개)`);
