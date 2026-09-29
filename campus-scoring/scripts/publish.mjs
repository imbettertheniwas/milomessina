// Generate the public entry point while retaining one source dashboard.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=new URL('../index.html',import.meta.url);
const target=new URL('../../campus/',import.meta.url);
const html=(await readFile(source,'utf8')).replace('<head>','<head>\n  <base href="/campus-scoring/">');
await mkdir(target,{recursive:true});
await writeFile(new URL('index.html',target),html);
console.log('Published campus/index.html; assets remain in campus-scoring/.');
