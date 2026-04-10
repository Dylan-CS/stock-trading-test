/**
 * Node.js test script for stock-trading-test
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(50));
console.log('Stock Trading Test - Automated Test Script');
console.log('='.repeat(50));

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
console.log(`\n[1] Loaded index.html (${html.length} chars)`);

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('❌ Could not extract JavaScript');
  process.exit(1);
}

const jsCode = scriptMatch[1];
console.log(`[2] Extracted JavaScript (${jsCode.length} chars)`);

// Extract data
const dimMatch = jsCode.match(/const dimensionOrder = \[([^\]]+)\]/);
const dimensionOrder = dimMatch ? dimMatch[1].replace(/'/g, '').split(',') : [];
console.log(`[3] Dimensions: ${dimensionOrder.length}`);

const qMatches = [...jsCode.matchAll(/id: '(\w+)', dim: '(\w+)'/g)];
const questions = qMatches.map(m => ({ id: m[1], dim: m[2] }));
console.log(`[4] Questions: ${questions.length}`);

const specialIds = [...jsCode.matchAll(/const specialQuestions = \[[\s\S]*?id: '(\w+)'/g)].map(m => m[1]);
console.log(`[5] Special questions: ${specialIds.length}`);

// Find TYPE_LIBRARY and TYPE_IMAGES boundaries
const libStart = jsCode.indexOf('const TYPE_LIBRARY = {');
const imgStart = jsCode.indexOf('const TYPE_IMAGES = {');
const libSection = jsCode.slice(libStart, imgStart);

// Extract type codes from TYPE_LIBRARY (Chinese chars allowed)
const typeCodes = [...libSection.matchAll(/"([^"]+)":\s*\{/g)].map(m => m[1]);
// Filter out duplicates and keep only the codes (first match for each)
const uniqueTypeCodes = [...new Set(typeCodes)];
console.log(`[6] TYPE_LIBRARY entries: ${uniqueTypeCodes.length}`);

// Extract TYPE_IMAGES - need to find proper closing
const imgContentStart = imgStart + 'const TYPE_IMAGES = {'.length;
let imgEnd = imgContentStart;
let braceCount = 1;
for (let i = imgContentStart; i < jsCode.length; i++) {
  if (jsCode[i] === '{') braceCount++;
  if (jsCode[i] === '}') braceCount--;
  if (braceCount === 0 && jsCode[i] === '}') {
    imgEnd = i + 1;
    break;
  }
}
const imgSection = jsCode.slice(imgContentStart, imgEnd);

// Extract image mappings - match "code": "./image/xxx.png"
const imageRegex = /"([^"]+)":\s*"\.\/image\/([^"]+\.png)"/g;
const imageMappings = [];
let imgMatch;
while ((imgMatch = imageRegex.exec(imgSection)) !== null) {
  imageMappings.push({ code: imgMatch[1], path: `./image/${imgMatch[2]}` });
}
console.log(`[7] TYPE_IMAGES mappings: ${imageMappings.length}`);

// Extract NORMAL_TYPES
const normStart = jsCode.indexOf('const NORMAL_TYPES = [');
const normEnd = jsCode.indexOf('];', normStart);
const normSection = jsCode.slice(normStart, normEnd + 2);
const normalTypes = [...normSection.matchAll(/"code":\s*"([^"]+)",\s*"pattern":\s*"([^"]+)"/g)].map(m => ({ code: m[1], pattern: m[2] }));
console.log(`[8] NORMAL_TYPES: ${normalTypes.length}`);

// Checks
console.log('\n' + '='.repeat(50));
console.log('CONSISTENCY CHECKS');
console.log('='.repeat(50));

const normalCodes = normalTypes.map(t => t.code);
const duplicates = normalCodes.filter((c, i) => normalCodes.indexOf(c) !== i);
if (duplicates.length > 0) {
  console.log(`❌ Duplicates in NORMAL_TYPES: ${duplicates}`);
} else {
  console.log(`✓ No duplicates in NORMAL_TYPES`);
}

const missingInLib = normalCodes.filter(c => !uniqueTypeCodes.includes(c));
if (missingInLib.length > 0) {
  console.log(`❌ Missing in TYPE_LIBRARY: ${missingInLib.join(', ')}`);
} else {
  console.log(`✓ All NORMAL_TYPES have TYPE_LIBRARY entries`);
}

// Check images
console.log('\n' + '='.repeat(50));
console.log('IMAGE CHECK');
console.log('='.repeat(50));

const missingImages = imageMappings.filter(({ code, path: imgPath }) => {
  const imgName = imgPath.split('/').pop();
  return !fs.existsSync(path.join(__dirname, 'image', imgName));
});

if (missingImages.length > 0) {
  console.log(`❌ Missing ${missingImages.length} images:`);
  missingImages.forEach(({ code, path }) => {
    console.log(`   - ${code}: ${path.split('/').pop()}`);
  });
} else {
  console.log(`✓ All ${imageMappings.length} images exist`);
}

// Lazy detection
console.log('\n' + '='.repeat(50));
console.log('CONFIGURATION');
console.log('='.repeat(50));

const lazyMatch = jsCode.match(/const isLazy = answeredCount (<=|>=|==|>) (\d+)/);
if (lazyMatch) {
  console.log(`✓ isLazy threshold: ${lazyMatch[2]} questions`);
} else {
  console.log(`⚠️ isLazy threshold not found`);
}

// Bracket balance
const opens = (jsCode.match(/\{/g) || []).length;
const closes = (jsCode.match(/\}/g) || []).length;
const parensOpen = (jsCode.match(/\(/g) || []).length;
const parensClose = (jsCode.match(/\)/g) || []).length;

console.log(`\nBracket balance:`);
console.log(`  Braces: ${opens}/${closes} ${opens === closes ? '✓' : '❌'}`);
console.log(`  Parens: ${parensOpen}/${parensClose} ${parensOpen === parensClose ? '✓' : '❌'}`);

// Summary
console.log('\n' + '='.repeat(50));
const issues = [];
if (duplicates.length > 0) issues.push('Duplicates');
if (missingInLib.length > 0) issues.push('Missing in TYPE_LIBRARY');
if (missingImages.length > 0) issues.push('Missing images');

if (issues.length > 0) {
  console.log(`❌ FAILED - ${issues.join(', ')}`);
  process.exit(1);
} else {
  console.log(`✅ ALL TESTS PASSED`);
  console.log(`   ${normalTypes.length} personality types`);
  console.log(`   ${imageMappings.length} images`);
  console.log(`   ${questions.length} questions`);
  process.exit(0);
}
