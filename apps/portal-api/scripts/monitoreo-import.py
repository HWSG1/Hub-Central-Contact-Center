#!/usr/bin/env python3
"""Monitoreo TC: validación sin SQL de archivos históricos Excel/CSV.
Solo mapea columnas autorizadas. Nunca exporta PAN completo, DNI ni filas a stdout.
Reutiliza lector XML/CSV seguro del importador TLV existente (sin openpyxl).
"""
from __future__ import annotations
import argparse
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
import importlib.util
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile
from xml.etree import ElementTree as ET

SOURCE = Path(__file__).with_name('tlv-import.py')
spec = importlib.util.spec_from_file_location('hub_tlv_reader', SOURCE)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
reader.MAX_INPUT_COLUMNS = 250

COLS = {
 'ID_TRX':'id_trx',
 'S_CUSTOMER_ID':'dni',
 'N_ID_ACCOUNT':'cuenta',
 'S_PAN':'tarjeta_enmascarada',
 'D_TRANSMISSION_DATE_AND_TIME':'fecha_evento',
 'S_ISS_FIRST_EVAL_RULE_DESCRIPTION':'regla',
 'N_ISS_FIRST_EVAL_RULE_ID':'regla_id',
 'S_RESPONSE_CODE':'respuesta_codigo',
 'S_MERCHANT_LEGAL_NAME':'comercio',
 'F_AMOUNT_TRANSACTION':'monto',
 'N_CARD_STATUS':'estado_tarjeta_origen'
}
REQUIRED = ('ID_TRX','D_TRANSMISSION_DATE_AND_TIME','S_RESPONSE_CODE')
def cleaned(x, limit=300):
    val=str(x or '').strip()
    if val.upper() in ('NULL','[NULL]','NAN'):return None
    if len(val)>limit or any(ord(c)<32 for c in val):raise ValueError('Campo excede longitud o contiene caracteres de control.')
    return val or None

def date_value(x, epoch1904):
    value=cleaned(x,40)
    if not value:raise ValueError('Falta fecha del evento.')
    if re.fullmatch(r'\d+(?:\.\d+)?',value):
        if len(value)==14:
            parsed=datetime.strptime(value,'%Y%m%d%H%M%S')
        else:
            start=datetime(1904,1,1) if epoch1904 else datetime(1899,12,30)
            parsed=start+timedelta(days=float(value))
    else:
        parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
    if not date(2000,1,1)<=parsed.date()<=date(2099,12,31):raise ValueError('Fecha fuera de rango.')
    return parsed.date().isoformat(),parsed.strftime('%Y-%m-%d %H:%M:%S')

def read(path):
    if path.suffix.lower()=='.csv':
        return reader.csv_rows(path,'')
    if path.suffix.lower()!='.xlsx':raise ValueError('Solo se permite .xlsx o .csv.')
    with ZipFile(path) as z:
        root=ET.fromstring(z.read('xl/workbook.xml'))
        ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        sheet=root.find(ns+'sheets')
        if sheet is None or not len(sheet):raise ValueError('Excel sin hojas.')
        name=sheet[0].get('name')
    return reader.xlsx_rows(path,name)

def normalize(rows, max_rows=50000):
    iterator=iter(rows)
    _,headers,_=next(iterator)
    positions={}
    for idx,val in enumerate(headers):
        k=str(val).strip().upper()
        if k in COLS and k not in positions:positions[k]=idx # Excel original tiene columnas duplicadas.
    missing=[k for k in REQUIRED if k not in positions]
    if missing:raise ValueError('Faltan columnas requeridas: '+', '.join(missing))
    records=[];seen=set();duplicate=0;ignored=0
    for number,values,epoch in iterator:
        if all(not str(x).strip() for x in values):continue
        if len(records)+duplicate+ignored>=max_rows:raise ValueError('El archivo excede 50,000 filas.')
        def field(key):
            i=positions.get(key)
            return values[i] if i is not None and i<len(values) else ''
        ident=cleaned(field('ID_TRX'),40)
        if not ident or not re.fullmatch(r'[A-Za-z0-9_-]{1,40}',ident):raise ValueError('Fila '+str(number)+': ID_TRX inválido.')
        if ident in seen:
            duplicate+=1;continue
        seen.add(ident)
        fecha,fecha_hora=date_value(field('D_TRANSMISSION_DATE_AND_TIME'),epoch)
        dni=cleaned(field('S_CUSTOMER_ID'),40)
        cuenta=cleaned(field('N_ID_ACCOUNT'),40)
        pan=cleaned(field('S_PAN'),40)
        if pan and (not re.fullmatch(r'[0-9*Xx]{8,19}',pan) or not re.search(r'[*Xx]',pan)):
            raise ValueError('Fila '+str(number)+': la tarjeta debe estar enmascarada; no se admite PAN completo.')
        digits=re.sub('[^0-9]','',pan or '')
        if pan and len(digits)<8:raise ValueError('Fila '+str(number)+': PAN insuficientemente identificable.')
        ref10=(digits[:6]+digits[-4:]) if pan and len(digits)>=10 else None
        last4=digits[-4:] if pan else None
        masked=(digits[:6]+'******'+digits[-4:]) if pan else None
        if not any((dni,cuenta,last4)):raise ValueError('Fila '+str(number)+': sin identificador de búsqueda.')
        amount=cleaned(field('F_AMOUNT_TRANSACTION'),40)
        if amount:
            try:
                d=Decimal(amount)
                if not d.is_finite() or abs(d)>=Decimal('1000000000000000'):raise ValueError()
                amount=format(d,'.4f')
            except (InvalidOperation,ValueError):raise ValueError('Fila '+str(number)+': monto inválido.')
        row=dict(
          id_trx=ident,dni=dni,cuenta=cuenta,tarjeta_referencia=last4,
          tarjeta_ref10=ref10,tarjeta_enmascarada=masked,fecha_evento=fecha,
          fecha_hora_origen=fecha_hora,regla=cleaned(field('S_ISS_FIRST_EVAL_RULE_DESCRIPTION')),
          regla_id=cleaned(field('N_ISS_FIRST_EVAL_RULE_ID'),40),
          respuesta_codigo=cleaned(field('S_RESPONSE_CODE'),40),
          comercio=cleaned(field('S_MERCHANT_LEGAL_NAME')),
          monto=amount,estado_tarjeta_origen=cleaned(field('N_CARD_STATUS'),40))
        records.append(row)
    return {'rows':records,'valid':len(records),'duplicated_in_file':duplicate,'ignored':ignored}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--input',required=True)
    p.add_argument('--output',required=True)
    args=p.parse_args()
    output=Path(args.output)
    if output.exists():raise ValueError('El archivo de salida ya existe.')
    result=normalize(read(Path(args.input)))
    if not result['valid']:raise ValueError('El archivo no contiene alertas válidas.')
    output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'valid':result['valid'],'duplicated_in_file':result['duplicated_in_file'],'ignored':result['ignored']}))
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(json.dumps({'error':str(e)[:300]}))
        sys.exit(2)
