'use strict';

/** Ports for local development. PORT is supported only as a legacy API fallback. */
function readPort(raw, name, fallback) {
 const text=String(raw??'').trim();
 if(!text)return fallback;
 if(!/^[0-9]+$/.test(text))throw new Error(name+' debe ser un puerto numerico.');
 const port=Number(text);
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error(name+' debe estar entre 1024 y 65535.');
 return port;
}

function resolveDevPorts(env) {
 const frontend=readPort(env.FRONTEND_PORT,'FRONTEND_PORT',4200);
 const backend=readPort(env.BACKEND_PORT||env.PORT,'BACKEND_PORT',3000);
 if(frontend===backend)throw new Error('FRONTEND_PORT y BACKEND_PORT deben ser diferentes.');
 return {frontend,backend};
}

function angularEnvironment(env) {
 const childEnv={...env};
 // Angular 22 fuerza PORT incluso sobre el flag --port: no heredarlo.
 delete childEnv.PORT;
 return childEnv;
}

module.exports={readPort,resolveDevPorts,angularEnvironment};
