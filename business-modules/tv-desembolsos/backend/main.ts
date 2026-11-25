type Api={query:(name:string,params:Record<string,unknown>)=>Promise<Record<string,unknown>[]>;write:(name:string,params:Record<string,unknown>)=>Promise<Record<string,unknown>[]>};
const allowedVentas=new Set(['EXTRA','INTRA','CORTA CUOTAS']);
const allowedDesembolsos=new Set(['CUENTA','VENTANILLA']);
const own=(x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null;
function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const t=new Date(s+'T00:00:00Z');return !Number.isNaN(+t)&&t.toISOString().slice(0,10)===s;}
export async function handle(operation:string,input:unknown,api:Api){
 if(operation==='health')return {ok:true};
 const data=own(input);if(!data)throw Error('Entrada inválida.');
 if(operation==='save'){
  if(Object.keys(data).some(k=>!['certificado','tipo_venta','tipo_desembolso','fecha_desembolso'].includes(k)))throw Error('Campos no admitidos.');
  const certificado=String(data.certificado??'').trim();const tipo_venta=String(data.tipo_venta??'').trim().toUpperCase();const tipo_desembolso=String(data.tipo_desembolso??'').trim().toUpperCase();const fecha_desembolso=String(data.fecha_desembolso??'');
  if(!/^\d{9}$/.test(certificado))throw Error('El certificado debe contener exactamente 9 dígitos.');
  if(!allowedVentas.has(tipo_venta))throw Error('Tipo de venta inválido.');
  if(!allowedDesembolsos.has(tipo_desembolso))throw Error('Tipo de desembolso inválido.');
  if(!validDate(fecha_desembolso))throw Error('Fecha de desembolso inválida.');
  const rows=await api.write('guardar',{certificado,tipo_venta,tipo_desembolso,fecha_desembolso});
  if(!rows.length)throw Error('El certificado ya está registrado.');return {ok:true,id:String(rows[0].id)};
 }
 if(operation==='history'){
  if(Object.keys(data).some(k=>!['period','page'].includes(k)))throw Error('Filtro inválido.');
  if(typeof data.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.period))throw Error('Período inválido.');
  const page=Number(data.page??0);if(!Number.isInteger(page)||page<0||page>10000)throw Error('Página inválida.');
  const rows=await api.query('historial',{period:data.period,page});
  return {rows:rows.slice(0,50),hasMore:rows.length>50,page,period:data.period};
 }
 throw Error('Operación no admitida.');
}
