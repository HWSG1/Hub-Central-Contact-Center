#!/usr/bin/env python3
"""Gestor transitorio de cargas TLV: lectura XLSX (stdlib), prevalidación, carga inactiva y activación SQL.
No elimina registros históricos, no almacena contraseñas, y no hace DDL.
La interfaz del Hub requiere una ampliación separada: esta utilidad se usa fuera del navegador.
"""
from __future__ import annotations
import argparse
import csv
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
from pathlib import Path, PurePosixPath
import re
import sys
import uuid
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
Q = lambda name: '{' + NS + '}' + name
FIELDS = (
    'TIPO_BASE','DNI','CODIGO_CLIENTE','COD_CLIENTE_CRM','CUENTA',
    'NUMERO_ADICIONALES_QUE_APLICA','NOMBRE_TC','METAL','HRE_ACTIVO',
    'ASISTENCIA_VIP_ACTIVO','VAP_ACTIVO','TASA_EXTRA','MONTO_OFERTA_EXTRA',
    'TASA_INTRA','MONTO_OFERTA_INTRA','MONTO_OFERTA_CC','RANGO_TASA_EXTRA',
    'ID_AREA','MES_BASE','MAIL','LIMITE','FLAG_FINAL_PAGO_CONTADO',
    'FLAG_EMPLEADO','ID_ORDEN_CRM','TIPO_FINANCIAMIENTO','FECHA_COMPRA',
    'PLAZO','CUENTA_DESTINO','MONTO','COMERCIO','NOMBRE_CLIENTE',
    'CATEGORIA','PAGO_IMPUESTO'
)
VARCHAR = {'DNI','CODIGO_CLIENTE','COD_CLIENTE_CRM','CUENTA','ID_ORDEN_CRM','CUENTA_DESTINO'}
NVARCHAR = set(FIELDS) - VARCHAR
DECIMAL_19 = {'MONTO_OFERTA_EXTRA','MONTO_OFERTA_INTRA','MONTO_OFERTA_CC','LIMITE','MONTO','PAGO_IMPUESTO'}
DECIMAL_9 = {'TASA_EXTRA','TASA_INTRA'}
INTEGERS = {'PLAZO'}
DATES = {'MES_BASE','FECHA_COMPRA'}
TEXT_EXTRA_VARCHAR = {'COTIZACION','OFERTA_CRM','TC_INGRESADA'}
NUMERIC = DECIMAL_19 | DECIMAL_9 | INTEGERS
DATE_MIN, DATE_MAX = date(1900,1,1), date(9999,12,31)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as fp:
        for part in iter(lambda: fp.read(2 * 1024 * 1024), b''):
            digest.update(part)
    return digest.hexdigest()


def col_index(reference: str) -> int:
    letters = re.match(r'^([A-Z]+)[0-9]+$', reference)
    if not letters:
        raise ValueError('Referencia de celda inválida.')
    n = 0
    for ch in letters.group(1):
        n = n * 26 + ord(ch) - 64
    return n - 1


def sheet_path(z: ZipFile, sheet_name: str) -> tuple[str, bool]:
    root = ET.fromstring(z.read('xl/workbook.xml'))
    wp = root.find(Q('workbookPr'))
    date1904 = wp is not None and wp.attrib.get('date1904') in ('1', 'true', 'TRUE')
    sheets = root.find(Q('sheets'))
    if sheets is None:
        raise ValueError('El Excel no tiene hojas.')
    entry = next((s for s in sheets if s.get('name') == sheet_name), None)
    if entry is None:
        raise ValueError('No existe la hoja ' + sheet_name)
    rid = entry.get('{' + REL + '}id')
    relationships = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    target = next((r.get('Target') for r in relationships if r.get('Id') == rid), None)
    if not target or '..' in PurePosixPath(target).parts:
        raise ValueError('Ruta de hoja inválida.')
    sheet = target.lstrip('/') if target.startswith('/xl/') else 'xl/' + target.lstrip('/')
    if sheet not in z.namelist():
        raise ValueError('Hoja no encontrada dentro del ZIP.')
    return sheet, date1904


def shared_strings(z: ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in z.namelist():
        return []
    strings = []
    with z.open('xl/sharedStrings.xml') as fp:
        for _, elem in ET.iterparse(fp, events=('end',)):
            if elem.tag == Q('si'):
                strings.append(''.join(n.text or '' for n in elem.iter(Q('t'))))
                elem.clear()
    return strings


def xlsx_rows(path: Path, sheet_name: str):
    with ZipFile(path) as z:
        names = z.namelist()
        if any(n.startswith('/') or '..' in PurePosixPath(n).parts for n in names):
            raise ValueError('Rutas ZIP inválidas.')
        sheet, epoch1904 = sheet_path(z, sheet_name)
        strings = shared_strings(z)
        with z.open(sheet) as fp:
            for _, elem in ET.iterparse(fp, events=('end',)):
                if elem.tag != Q('row'):
                    continue
                row_no = int(elem.get('r', '0'))
                cells = [''] * len(FIELDS)
                for cell in elem.findall(Q('c')):
                    idx = col_index(cell.get('r', ''))
                    if idx >= len(FIELDS):
                        if any((node.text or '').strip() for node in cell.iter() if node.tag in (Q('t'),Q('v'))):
                            raise ValueError('El Excel contiene datos fuera de las 33 columnas, fila ' + str(row_no))
                        continue
                    value = cell.find(Q('v'))
                    typ = cell.get('t', 'n')
                    if typ == 's':
                        if value is None or value.text is None:
                            cells[idx] = ''
                        else:
                            cells[idx] = strings[int(value.text)]
                    elif typ == 'inlineStr':
                        inline = cell.find(Q('is'))
                        cells[idx] = ''.join(t.text or '' for t in inline.iter(Q('t'))) if inline is not None else ''
                    elif typ == 'e':
                        raise ValueError('Celda con error de Excel en fila ' + str(row_no))
                    else:
                        cells[idx] = (value.text or '') if value is not None else ''
                elem.clear()
                yield row_no, cells, epoch1904


def csv_rows(path: Path, sheet_name: str):
    """CSV UTF-8 (with optional BOM); same 33 columns and validation as the XLSX original."""
    with path.open('r', encoding='utf-8-sig', newline='') as fp:
        reader = csv.reader(fp, strict=True)
        for line_no, row in enumerate(reader, start=1):
            if len(row) != len(FIELDS):
                raise ValueError(f'CSV fila {line_no}: se esperaban {len(FIELDS)} columnas y hay {len(row)}')
            yield line_no, row, False


def parse_cell(field: str, raw: str, epoch1904: bool):
    x = str(raw).strip()
    if x == '' or x.upper() in ('[NULL]',):
        return None
    if field in DATES:
        try:
            if re.fullmatch(r'-?\d+(?:\.\d+)?', x):
                val = Decimal(x)
                if val != val.to_integral_value():
                    raise ValueError('fecha con hora/fracción')
                start = datetime(1904, 1, 1) if epoch1904 else datetime(1899, 12, 30)
                converted = (start + timedelta(days=int(val))).date()
            else:
                converted = date.fromisoformat(x)
        except (ValueError, OverflowError, InvalidOperation):
            raise ValueError(field + ': fecha inválida')
        if converted < DATE_MIN or converted > DATE_MAX:
            raise ValueError(field + ': fecha fuera de rango')
        return converted
    if field in NUMERIC:
        try:
            d = Decimal(x)
            if not d.is_finite():
                raise ValueError()
            if field in INTEGERS:
                if d != d.to_integral_value() or not (-2147483648 <= d <= 2147483647):
                    raise ValueError()
                return int(d)
            d = d.quantize(Decimal('.0001'), rounding=ROUND_HALF_UP)
            limit = Decimal('99999.9999') if field in DECIMAL_9 else Decimal('999999999999999.9999')
            if abs(d) > limit:
                raise ValueError()
            return d
        except (InvalidOperation, ValueError):
            raise ValueError(field + ': número inválido o excede precisión')
    max_length = 40 if field in VARCHAR else 300
    if len(x) > max_length:
        raise ValueError(field + ': excede ' + str(max_length) + ' caracteres')
    return x


def scanned_rows(path: Path, hoja: str, modo: str, tipo: str | None):
    it = csv_rows(path, hoja) if path.suffix.lower() == ".csv" else xlsx_rows(path, hoja)
    first_no, header, _ = next(it)
    header = tuple(str(v).strip() for v in header)
    if header != FIELDS:
        detail = [(i+1, FIELD, h) for i,(FIELD,h) in enumerate(zip(FIELDS,header)) if FIELD != h]
        raise ValueError('Los 33 encabezados deben coincidir exactamente y en el mismo orden. Diferencias: ' + repr(detail[:5]))
    for row_no, cells, epoch1904 in it:
        if not any(str(v).strip() for v in cells):
            continue
        values = []
        errors = []
        for field, raw in zip(FIELDS,cells):
            try:
                values.append(parse_cell(field, raw, epoch1904))
            except ValueError as e:
                errors.append(str(e))
                values.append(None)
        if values[0] is None:
            errors.append('TIPO_BASE: obligatorio')
        if not any(values[FIELDS.index(name)] for name in ('DNI','CODIGO_CLIENTE','CUENTA')):
            errors.append('Se requiere DNI, CODIGO_CLIENTE o CUENTA')
        if modo == 'reemplazo-tipo' and values[0] != tipo:
            errors.append('TIPO_BASE diferente al solicitado')
        yield row_no, tuple(values), errors


def preflight(path: Path, hoja: str, modo: str, tipo: str | None, max_errors: int = 20):
    count = 0
    tipos = Counter()
    meses = Counter()
    failures = []
    rejected = 0
    for row_no, values, errors in scanned_rows(path, hoja, modo, tipo):
        if errors:
            rejected += 1
            if len(failures) < max_errors:
                failures.append((row_no, '; '.join(errors[:3])))
            continue
        count += 1
        tipos[values[0]] += 1
        if values[FIELDS.index('MES_BASE')]:
            meses[values[FIELDS.index('MES_BASE')].strftime('%Y-%m')] += 1
    return count, rejected, tipos, meses, failures


def query_one(c, query, params=()):
    cursor = c.cursor()
    cursor.execute(query, params)
    result = cursor.fetchone()
    cursor.close()
    return result


def run(args):
    path = Path(args.archivo)
    if not path.is_file() or path.suffix.lower() not in ('.xlsx', '.csv'):
        raise ValueError('Selecciona un archivo .xlsx o .csv existente.')
    if path.stat().st_size > 250*1024*1024:
        raise ValueError('El archivo excede el límite local de 250 MB.')
    user_hub = str(uuid.UUID(args.usuario_hub)) if args.usuario_hub else None
    mode = 'REEMPLAZO_TOTAL' if args.modo == 'reemplazo-total' else 'REEMPLAZO_TIPO'
    if args.modo == 'reemplazo-tipo' and not args.tipo_base:
        raise ValueError('--tipo-base es obligatorio con reemplazo-tipo.')
    print('Revisando formato, tipos y filas...',flush=True)
    good,bad,tipos,meses,failures = preflight(path,args.hoja,args.modo,args.tipo_base)
    print('Registros válidos:',good, '| Rechazados:',bad)
    print('Tipos de base:',len(tipos),'| Períodos:',dict(meses.most_common(5)))
    for tipo,n in tipos.most_common():
        print(' -',tipo,':',n)
    for row,reason in failures:
        print(' ERROR fila',row,reason)
    if args.previsualizar:
        print('PREVISUALIZACIÓN COMPLETA: sin cambios en SQL Server.')
        if not good or bad:
            print('Previsualización rechazada: corrige los datos antes de cargar.',file=sys.stderr)
            return 1
        return 0
    if args.confirmar != 'CAMBIAR_BASE':
        raise ValueError('Para activar una carga real incluye --confirmar CAMBIAR_BASE.')
    if not args.servidor or not args.base:
        raise ValueError('Indica --servidor y --base explícitamente.')
    if not re.fullmatch(r'[\w .\\-]{1,128}', args.servidor) or not re.fullmatch(r'[A-Za-z0-9_]{1,100}',args.base):
        raise ValueError('Nombre de servidor o base inválido.')
    try:
        import pyodbc
    except ImportError as ex:
        raise RuntimeError('Instala pyodbc: py -m pip install -r herramientas/requirements.txt') from ex
    if any(x in args.driver for x in (';','{','}')):
        raise ValueError('Nombre de controlador inválido.')
    # Usar el mismo puerto TCP configurado para la API del Hub. Un servidor
    # sin puerto intenta la instancia predeterminada (1433) e ignora SQL_PORT.
    if args.puerto is not None and not (1 <= args.puerto <= 65535):
        raise ValueError('Puerto SQL fuera de rango.')
    server_address = ('tcp:' + args.servidor + ',' + str(args.puerto)) if args.puerto else args.servidor
    conn = pyodbc.connect('DRIVER={' + args.driver + '};SERVER=' + server_address + ';DATABASE=' + args.base
                          + ';Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=
                          + ('Yes;' if args.certificado_desarrollo else 'No;') + 'APP=TLV-Carga-Auditada;', timeout=25)
    c = conn.cursor()
    try:
        exists = query_one(conn, "SELECT OBJECT_ID(N'mod_ofertas_tlv.cargas',N'U'),COL_LENGTH('mod_ofertas_tlv.base_tlv','carga_id')")
        if not exists or exists[0] is None or exists[1] is None:
            raise RuntimeError('Ejecuta sql/01_preparar_auditoria.sql primero, con autorización DBA.')
        batchid = str(uuid.uuid4())
        digest = sha256_file(path)
        if not good or bad:
            c.execute("INSERT mod_ofertas_tlv.cargas(carga_id,archivo,sha256,modalidad,tipo_base,usuario_bd,usuario_hub,esperados,rechazados,estado,error_resumen) VALUES(?,?,?,?,?,ORIGINAL_LOGIN(),?,?,?,'FALLIDA',?)",
                      (batchid,path.name,digest,mode,args.tipo_base,user_hub,good+bad,bad,'Validación rechazada: revisar errores.'))
            errs=[]
            for row_no, _values, problems in scanned_rows(path,args.hoja,args.modo,args.tipo_base):
                if not problems: continue
                errs.append((batchid,row_no,None,'; '.join(problems[:3])[:500]))
                if len(errs)>=500:
                    c.executemany('INSERT mod_ofertas_tlv.carga_errores(carga_id,fila_excel,columna,motivo) VALUES(?,?,?,?)',errs)
                    errs=[]
            if errs:
                c.executemany('INSERT mod_ofertas_tlv.carga_errores(carga_id,fila_excel,columna,motivo) VALUES(?,?,?,?)',errs)
            c.execute("INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,usuario_hub,detalle) VALUES(?,'RECHAZAR',ORIGINAL_LOGIN(),?,?)",
                      (batchid,user_hub,'Falló validación previa; filas rechazadas: '+str(bad)))
            conn.commit()
            print('Carga RECHAZADA y auditada. ID:',batchid,file=sys.stderr)
            return 1
        periodo = None
        if len(meses)==1:
            periodo = date.fromisoformat(next(iter(meses)) + '-01')
        c.execute("INSERT mod_ofertas_tlv.cargas(carga_id,archivo,sha256,modalidad,tipo_base,periodo,usuario_bd,usuario_hub,esperados,estado) VALUES(?,?,?,?,?,?,ORIGINAL_LOGIN(),?,?,'CARGANDO')",
                  (batchid,path.name,digest,mode,args.tipo_base,periodo,user_hub,good))
        c.execute("INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,usuario_hub,detalle) VALUES(?,'INICIO',ORIGINAL_LOGIN(),?,?)",
                  (batchid,user_hub,'Archivo validado: ' + str(good) + ' filas.'))
        conn.commit()
        fields = ','.join('['+f+']' for f in FIELDS)
        sql = 'INSERT mod_ofertas_tlv.base_tlv (' + fields + ',activo,carga_id,archivo_fila) VALUES (' + ','.join(['?']*(len(FIELDS)+3)) + ')'
        stage=[]
        written=0
        try:
            for row_no, values, errors in scanned_rows(path, args.hoja, args.modo, args.tipo_base):
                if errors: raise RuntimeError('Cambió el Excel desde la prevalidación (fila ' + str(row_no) + ').')
                stage.append((*values,0,batchid,row_no))
                if len(stage)>=args.lote:
                    c.fast_executemany=True
                    c.executemany(sql,stage)
                    written += len(stage)
                    c.execute('UPDATE mod_ofertas_tlv.cargas SET insertados=? WHERE carga_id=?',(written,batchid))
                    conn.commit()
                    stage=[]
                    print('Cargados inactivos:',written,flush=True)
            if stage:
                c.fast_executemany=True
                c.executemany(sql,stage)
                written+=len(stage)
                c.execute('UPDATE mod_ofertas_tlv.cargas SET insertados=? WHERE carga_id=?',(written,batchid))
                conn.commit()
            if written != good or sha256_file(path) != digest:
                raise RuntimeError('El número de filas o SHA-256 cambió durante la carga.')
            print('Validado lote',batchid,', iniciando activación atómica...')
            c.execute('EXEC mod_ofertas_tlv.activar_carga @carga_id=?',(batchid,))
            conn.commit()
            print('CARGA ACTIVADA. ID DE AUDITORÍA:',batchid,'| Registros:',written)
            return 0
        except Exception as ex:
            conn.rollback()
            try:
                c.execute("UPDATE mod_ofertas_tlv.cargas SET estado='FALLIDA',error_resumen=? WHERE carga_id=? AND estado='CARGANDO'",(str(ex)[:1000],batchid))
                c.execute("INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,usuario_hub,detalle) VALUES(?,'ERROR',ORIGINAL_LOGIN(),?,?)",(batchid,user_hub,str(ex)[:1000]))
                conn.commit()
            except Exception:
                conn.rollback()
            raise RuntimeError('La base vigente NO fue reemplazada. Lote: '+batchid+'; causa: '+str(ex)) from ex
    finally:
        conn.close()


def main():
    ap=argparse.ArgumentParser(description='Previsualiza e importa bases TLV; mantiene historial inactivo.')
    ap.add_argument('--archivo',required=True,help='Ruta del consolidado .xlsx o .csv')
    ap.add_argument('--usuario-hub',default='',help='GUID del usuario Hub autenticado, solo suministrado por API')
    ap.add_argument('--hoja',default='Consulta1')
    ap.add_argument('--previsualizar',action='store_true')
    ap.add_argument('--modo',choices=['reemplazo-total','reemplazo-tipo'],default='reemplazo-total')
    ap.add_argument('--tipo-base',help='Valor exacto de TIPO_BASE si reemplazas uno solo')
    ap.add_argument('--servidor')
    ap.add_argument('--puerto',type=int,default=None,help='Puerto TCP SQL Server, igual que SQL_PORT de la API')
    ap.add_argument('--base')
    ap.add_argument('--driver',default='ODBC Driver 18 for SQL Server')
    ap.add_argument('--certificado-desarrollo',action='store_true',help='SOLO local: aceptar certificado autofirmado')
    ap.add_argument('--confirmar',default='')
    ap.add_argument('--lote',type=int,default=500)
    args=ap.parse_args()
    if args.lote<1 or args.lote>1000: ap.error('--lote entre 1 y 1000')
    try: return run(args)
    except Exception as e:
        print('ERROR:',e,file=sys.stderr)
        return 2


if __name__=='__main__':
    sys.exit(main())