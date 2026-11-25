import {strToU8,zipSync} from 'fflate';

const columns=[
 'ID_TRX','D_TRANSMISSION_DATE_AND_TIME','S_CUSTOMER_ID','N_ID_ACCOUNT',
 'S_PAN','S_ISS_FIRST_EVAL_RULE_DESCRIPTION','N_ISS_FIRST_EVAL_RULE_ID',
 'S_RESPONSE_CODE','S_MERCHANT_LEGAL_NAME','F_AMOUNT_TRANSACTION','N_CARD_STATUS'
];
const examples=[
 ['Campo','Indicaciones'],
 ['ID_TRX','Obligatorio. Identificador único de la transacción; se usa para evitar duplicados.'],
 ['D_TRANSMISSION_DATE_AND_TIME','Obligatorio. Formato AAAA-MM-DD HH:MM:SS.'],
 ['S_RESPONSE_CODE','Obligatorio. Guardar como texto; ejemplo: 00 o 5C.'],
 ['S_CUSTOMER_ID','DNI o identificador del cliente, conservar los ceros iniciales.'],
 ['N_ID_ACCOUNT','Cuenta como texto, conservar ceros iniciales.'],
 ['S_PAN','Solo tarjeta enmascarada: seis dígitos iniciales, seis asteriscos y cuatro últimos. No incluir PAN completo.'],
 ['S_ISS_FIRST_EVAL_RULE_DESCRIPTION','Regla o motivo de la alerta.'],
 ['N_ISS_FIRST_EVAL_RULE_ID','Identificador de la regla.'],
 ['S_MERCHANT_LEGAL_NAME','Nombre del comercio.'],
 ['F_AMOUNT_TRANSACTION','Monto numérico, sin separadores de miles.'],
 ['N_CARD_STATUS','Estado original de la fuente, no interpretarlo como bloqueo activo.']
];
const xml=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function sheet(rows:string[][]){
 const body=rows.map((values,i)=>'<row r="'+(i+1)+'">'+values.map((value,j)=>{
  let n=j+1,label='';while(n){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26);}
  return '<c r="'+label+(i+1)+'" t="inlineStr"><is><t>'+xml(value)+'</t></is></c>';
 }).join('')+'</row>').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>';
}
export function downloadMonitoreoTemplate(){
 const files:Record<string,Uint8Array>={
  '[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
    '</Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  'xl/workbook.xml':strToU8('<?xml version="1.0" encoding="UTF-8"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets><sheet name="DatosBloqueos" sheetId="1" r:id="rId1"/><sheet name="Instrucciones" sheetId="2" r:id="rId2"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':strToU8(sheet([columns])),
  'xl/worksheets/sheet2.xml':strToU8(sheet(examples))
 };
 const bytes=zipSync(files,{level:6});
 const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download='Plantilla_Monitoreo_TC.xlsx';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
