import {createServer} from 'node:http';
import {database} from './db.mjs';
import {application} from './app.mjs';
const db=await database();
const server=createServer(application(db));
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Courtside API listening.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
