"""Pruebas de importacion flexible TLV, sin conectar a SQL Server."""
import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / 'apps/portal-api/scripts/tlv-import.py'
SPEC = importlib.util.spec_from_file_location('tlv_import_for_tests', SCRIPT)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class TlvImportColumnsTests(unittest.TestCase):
    def test_schema_matches_installed_tlv_package(self):
        path = ROOT / 'business-modules/ofertas-package/migrations/001.json'
        schema = json.loads(path.read_text(encoding='utf-8'))
        columns = [entry['name'] for entry in schema['tables'][0]['columns']]
        self.assertEqual(list(mod.FIELDS), columns)
        self.assertEqual(len(columns), 42)

    def make_csv(self, headers, values):
        temporary = tempfile.TemporaryDirectory()
        path = Path(temporary.name) / 'base.csv'
        with path.open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(headers)
            writer.writerow(values)
        self.addCleanup(temporary.cleanup)
        return path

    def test_noviembre_2026_exact_36_headers(self):
        headers = list(mod.FIELDS[:33]) + ['LIMITE_NUEVO_USD','COLOR_NUEVO','DIFERENCIA']
        values = [''] * len(headers)
        values[0] = 'BASE ADICIONALES'
        values[1] = '0012300456789'
        values[headers.index('LIMITE_NUEVO_USD')] = '2300'
        values[headers.index('DIFERENCIA')] = '500'
        path = self.make_csv(headers, values)
        rows = list(mod.scanned_rows(path, 'Consulta1', 'reemplazo-total', None))
        self.assertEqual(len(rows), 1)
        _, record, errors = rows[0]
        self.assertEqual(errors, [])
        self.assertEqual(record[mod.FIELDS.index('DNI')], '0012300456789')
        self.assertEqual(str(record[mod.FIELDS.index('LIMITE_NUEVO_USD')]), '2300.0000')
        self.assertEqual(record[mod.FIELDS.index('COTIZACION')], None)

    def test_33_columns_and_any_order_work(self):
        headers = ['CUENTA','TIPO_BASE','NOMBRE_CLIENTE']
        values = ['000010012340','BASE TC','Cliente de prueba']
        path = self.make_csv(headers, values)
        row = next(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))[1]
        self.assertEqual(row[mod.FIELDS.index('CUENTA')],'000010012340')
        self.assertEqual(row[mod.FIELDS.index('NOMBRE_CLIENTE')],'Cliente de prueba')
        self.assertIsNone(row[mod.FIELDS.index('FLAG1')])

    def test_aliases_from_base_example(self):
        path=self.make_csv(['TIPO_BASE','IDENTIDAD','COD_CLIENTE_IBS','CUENTA_TC','PAGO_IMPUESTOS'],
                           ['FINANCIAMIENTOS','0801197700001','000123','000456','2000'])
        row=next(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))[1]
        self.assertEqual(row[mod.FIELDS.index('CODIGO_CLIENTE')],'000123')
        self.assertEqual(row[mod.FIELDS.index('DNI')],'0801197700001')
        self.assertEqual(row[mod.FIELDS.index('CUENTA')],'000456')
        self.assertEqual(str(row[mod.FIELDS.index('PAGO_IMPUESTO')]),'2000.0000')

    def test_unknown_columns_are_rejected_not_discarded(self):
        path=self.make_csv(['TIPO_BASE','DNI','NUEVA_COLUMNA'],['B','001','texto'])
        with self.assertRaisesRegex(ValueError,'desconocidas'):
            list(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))

    def test_duplicate_normalized_aliases_are_rejected(self):
        path=self.make_csv(['TIPO_BASE','DNI','IDENTIDAD'],['B','001','002'])
        with self.assertRaisesRegex(ValueError,'duplicados'):
            list(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))

    def test_minimum_headers_are_required(self):
        path=self.make_csv(['TIPO_BASE','NOMBRE_CLIENTE'],['B','Cliente'])
        with self.assertRaisesRegex(ValueError,'DNI, CODIGO_CLIENTE o CUENTA'):
            list(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))

    def test_xlsx_sparse_36_columns_read_by_header(self):
        headers=list(mod.FIELDS[:33])+['LIMITE_NUEVO_USD','COLOR_NUEVO','DIFERENCIA']
        from xml.sax.saxutils import escape
        def row(number, values):
            def cell(index,value):
                col=''
                index+=1
                while index:
                    index, remainder=divmod(index-1,26)
                    col=chr(65+remainder)+col
                return '<c r="'+col+str(number)+'" t="inlineStr"><is><t>'+escape(value)+'</t></is></c>'
            return '<row r="'+str(number)+'">'+''.join(cell(i,str(value)) for i,value in enumerate(values) if value!='')+'</row>'
        values=['']*len(headers)
        values[0]='BASE ADICIONALES'
        values[1]='0000000000001'
        values[-3]='4000'
        worksheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+row(1,headers)+row(2,values)+'</sheetData></worksheet>'
        workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Consulta1" sheetId="1" r:id="rId1"/></sheets></workbook>'
        relationships='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path=Path(tmp.name)/'test.xlsx'
        with ZipFile(path,'w',compression=ZIP_DEFLATED) as z:
            z.writestr('xl/workbook.xml',workbook)
            z.writestr('xl/_rels/workbook.xml.rels',relationships)
            z.writestr('xl/worksheets/sheet1.xml',worksheet)
        rowdata=next(mod.scanned_rows(path,'Consulta1','reemplazo-total',None))
        self.assertEqual(rowdata[2],[])
        self.assertEqual(rowdata[1][mod.FIELDS.index('DNI')],'0000000000001')


if __name__ == '__main__':
    unittest.main()
