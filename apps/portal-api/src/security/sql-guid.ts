import { BadRequestException,Injectable,type PipeTransform } from '@nestjs/common';

// SQL uniqueidentifier is a 128-bit GUID; do not impose RFC version/variant bits.
// Exact canonical text only: no braces, whitespace or SQL-style truncation.
export const SQL_GUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\s\S])/i;
@Injectable()
export class ParseSqlGuidPipe implements PipeTransform<unknown,string> {
 transform(value:unknown){
  if(typeof value!=='string'||!SQL_GUID_PATTERN.test(value))throw new BadRequestException('El identificador debe ser un GUID válido de SQL Server.');
  return value;
 }
}
