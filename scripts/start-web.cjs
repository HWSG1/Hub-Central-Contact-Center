'use strict';

const {spawn}=require('node:child_process');
const {existsSync,mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const {parseEnv}=require('node:util');
const path=require('node:path');
const {resolveDevPorts,angularEnvironment}=require('./dev-ports.cjs');

function main(){
 const root=path.resolve(__dirname,'..');
 // Read only port settings from .env; do not load SQL/OIDC/MFA secrets into ng serve.
 const settings=parseEnv(readFileSync(path.join(root,'.env'),'utf8'));
 const portEnv={...process.env};
 for(const key of ['FRONTEND_PORT','BACKEND_PORT','PORT']){
  if(portEnv[key]===undefined&&settings[key]!==undefined)portEnv[key]=settings[key];
 }
 const {frontend,backend}=resolveDevPorts(portEnv);
 const cli=path.join(root,'node_modules','@angular','cli','bin','ng.js');
 if(!existsSync(cli))throw new Error('Angular CLI no esta instalado. Ejecute npm.cmd ci.');
 const localDir=path.join(root,'.local');
 mkdirSync(localDir,{recursive:true});
 const proxyFile=path.join(localDir,'dev-proxy.json');
 writeFileSync(proxyFile,JSON.stringify({'/api':{target:'http://127.0.0.1:'+backend,secure:true}})+'\n',{encoding:'utf8',mode:0o600});
 console.log('Frontend: http://127.0.0.1:'+frontend+' | API proxy: http://127.0.0.1:'+backend);
 const flags=['serve','--host','127.0.0.1','--proxy-config',proxyFile,'--port',String(frontend),...process.argv.slice(2)];
 const child=spawn(process.execPath,[cli,...flags],{cwd:root,env:angularEnvironment(process.env),stdio:'inherit'});
 child.on('error',error=>{console.error('No fue posible iniciar Angular:',error.message);process.exitCode=1;});
 child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
}
try{main();}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
