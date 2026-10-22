import { readFileSync } from 'node:fs';

// SQLite is an isolated local/test adapter. Production requires Postgres.
export async function database({url = process.env.DATABASE_URL, file = process.env.SQLITE_PATH || ':memory:', production = process.env.NODE_ENV === 'production'} = {}) {
  let pg, sqlite, chain = Promise.resolve();
  if (url) {
    const { Pool } = await import('pg');
    pg = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  } else {
    if (production) throw Error('Production requires DATABASE_URL; SQLite is test/local only.');
    const { DatabaseSync } = await import('node:sqlite');
    sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }
  function runner(client) {
    return async (sql, params = []) => {
      if (client) return (await client.query(sql, params)).rows;
      const binds = [];
      const rewritten = sql.replace(/\$(\d+)/g, (_, n) => { binds.push(params[Number(n)-1]); return '?'; });
      const statement = sqlite.prepare(rewritten);
      return statement.columns().length ? statement.all(...binds) : (statement.run(...binds), []);
    };
  }
  const rawQuery = runner(pg);
  const query = pg ? rawQuery : (sql, params) => {
    const task = chain.then(() => rawQuery(sql, params));
    chain = task.catch(() => {});
    return task;
  };
  async function transaction(work) {
    if (pg) {
      const client = await pg.connect();
      try { await client.query('BEGIN'); const value = await work(runner(client)); await client.query('COMMIT'); return value; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    const task = chain.then(async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const value = await work(rawQuery); sqlite.exec('COMMIT'); return value; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    });
    chain = task.catch(() => {});
    return task;
  }
  for (const sql of readFileSync(new URL('./schema.sql', import.meta.url),'utf8').split(';').map(s => s.trim()).filter(Boolean)) await query(sql);
  return {query, transaction, close: async () => {await chain; if(pg) await pg.end(); else sqlite.close();}};
}
