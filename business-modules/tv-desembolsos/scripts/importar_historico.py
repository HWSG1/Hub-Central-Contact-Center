#!/usr/bin/env python3
"""Importación controlada de TV_Certificados (CSV UTF-8), sin escrituras por defecto.
Requiere pyodbc exclusivamente al utilizar --apply. Credenciales por identidad Windows.
NO contiene ni descarga datos SharePoint. No utiliza TV_Ventas.
"""
import argparse,csv,collections,re,sys
from pathlib import Path
COLS=["id_origen","certificado","tipo_venta","tipo_desembolso","fecha_desembolso","correo_origen","gestion_origen","estado_origen","observacion_origen","cuenta_tc_origen","fecha_creacion_origen","creado_por_nombre"]
def nul(x):return x.strip() or None
def main():
 p=argparse.ArgumentParser();p.add_argument("--csv",required=True,type=Path);p.add_argument("--server");p.add_argument("--database");p.add_argument("--mapping",type=Path,help="CSV encabezados correo,hub_user_id; revisado y aprobado por administrador.");p.add_argument("--apply",action="store_true");p.add_argument("--confirm",default="");a=p.parse_args()
 with a.csv.open(encoding="utf-8-sig",newline="") as f:
  reader=csv.DictReader(f)
  if not set(COLS).issubset(reader.fieldnames or []):p.error("Columnas CSV incompletas.")
  rows=list(reader)
 if len(rows)!=16538:p.error("Conteo inesperado: se esperaban 16,538 registros.")
 keys=[r["id_origen"] for r in rows]
 if len(set(keys))!=len(keys) or any(not re.fullmatch("[a-f0-9]{40}",k) for k in keys):p.error("Identificadores de importación inválidos o duplicados.")
 for i,r in enumerate(rows,2):
  if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",r["fecha_desembolso"]):p.error(f"Fecha inválida en fila {i}.")
  if r["certificado"] and not re.fullmatch(r"\d{9}",r["certificado"]):p.error(f"Certificado inválido en fila {i}.")
 print(f"PREVISUALIZACIÓN: {len(rows)} registros; sin certificado={sum(not r['certificado'] for r in rows)}; sin tipo venta={sum(not r['tipo_venta'] for r in rows)}; sin tipo desembolso={sum(not r['tipo_desembolso'] for r in rows)}")
 if not a.apply:return
 if a.confirm!="TV_CERTIFICADOS_16538" or not a.server or not a.database:p.error("Para aplicar: --server, --database, --apply y --confirm TV_CERTIFICADOS_16538.")
 mapping={}
 if a.mapping:
  with a.mapping.open(encoding="utf-8-sig",newline="") as f:
   for r in csv.DictReader(f):
    email=r["correo"].strip().lower();uid=r["hub_user_id"].strip()
    if not email or not re.fullmatch(r"[0-9a-fA-F-]{36}",uid) or email in mapping:p.error("Correspondencia de usuario inválida o repetida.")
    mapping[email]=uid
 import pyodbc
 conn=pyodbc.connect("DRIVER={ODBC Driver 18 for SQL Server};SERVER="+a.server+";DATABASE="+a.database+";Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=no",autocommit=False,timeout=30)
 inserted=skipped=0
 sql="""INSERT INTO [mod_tv_desembolsos].[certificados]
 (id_origen,certificado,tipo_venta,tipo_desembolso,fecha_desembolso,correo_origen,gestion_origen,estado_origen,observacion_origen,cuenta_tc_origen,fecha_creacion_origen,registrado_por)
 OUTPUT INSERTED.id
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?
 WHERE NOT EXISTS (SELECT 1 FROM [mod_tv_desembolsos].[certificados] WITH (UPDLOCK,HOLDLOCK) WHERE id_origen=?)"""
 try:
  cur=conn.cursor()
  for uid in set(mapping.values()):
   if not cur.execute("SELECT 1 FROM core.users WHERE id=? AND enabled=1",uid).fetchone():raise ValueError("Usuario no activo o inexistente en mapping.")
  for r in rows:
   uid=mapping.get((r["correo_origen"] or "").strip().lower())
   vals=[nul(r[k]) for k in COLS[:11]]+[uid,r["id_origen"]]
   saved=cur.execute(sql,*vals).fetchone()
   if saved:inserted+=1
   else:skipped+=1
  conn.commit()
  print(f"IMPORTACIÓN CONFIRMADA: insertados={inserted}, ya existentes={skipped}, vinculados a usuarios={sum(bool(mapping.get(r['correo_origen'].strip().lower())) for r in rows)}")
 except Exception:
  conn.rollback();raise
 finally:conn.close()
if __name__=="__main__":main()
