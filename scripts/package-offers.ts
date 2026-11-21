import {writeFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {offersDescriptor} from '../apps/portal-api/src/business/registry.js';
import {inspectPackage} from '../apps/portal-api/src/business/package.js';

const bytes=zipSync({'manifest.json':strToU8(JSON.stringify(offersDescriptor,null,2))},{mtime:new Date('2026-01-01T00:00:00Z')});
const report=inspectPackage(Buffer.from(bytes).toString('base64'));
const path='business-modules/ofertas/ofertas-1.0.0.zip';
writeFileSync(path,bytes);
console.log(`${path}: ${report.size} bytes; importador validado; SHA-256 ${report.sha256}`);
