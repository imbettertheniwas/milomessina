import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../lib/visits.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
fs.writeFileSync(new URL('../../server/visits/validation.mjs',import.meta.url),'// Generated from visit-form/lib/visits.ts by npm run build.\n'+outputText);
