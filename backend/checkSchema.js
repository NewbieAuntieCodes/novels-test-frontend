const sqlite3 = require('better-sqlite3');
const db = sqlite3('./prisma/dev.db');

console.log('=== AnnotationTag 表结构 ===');
const tableInfo = db.prepare("PRAGMA table_info(AnnotationTag)").all();
console.log(tableInfo);

console.log('\n=== AnnotationTag 前5条数据 ===');
const data = db.prepare("SELECT * FROM AnnotationTag LIMIT 5").all();
console.log(data);

console.log('\n=== AnnotationTag 数据总数 ===');
const count = db.prepare("SELECT COUNT(*) as count FROM AnnotationTag").get();
console.log(count);

db.close();
