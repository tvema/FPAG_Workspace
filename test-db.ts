import Database from "better-sqlite3";
const db = new Database(':memory:');
db.exec('CREATE TABLE test (val BOOLEAN DEFAULT 0)');
db.prepare('INSERT INTO test (val) VALUES (0)').run();
db.prepare('INSERT INTO test (val) VALUES (1)').run();
console.log(db.prepare('SELECT * FROM test').all());
