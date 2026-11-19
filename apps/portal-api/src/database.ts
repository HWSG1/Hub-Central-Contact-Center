import { Injectable, OnModuleDestroy } from '@nestjs/common';
import sql from 'mssql';
import native from 'mssql/msnodesqlv8.js';
import { config } from './config.js';
@Injectable()
export class Database implements OnModuleDestroy {
 private pool?:Promise<sql.ConnectionPool>;
 connect(){return this.pool??=this.open().catch(e=>{this.pool=undefined;throw e;});}
 private async open(){
 const options={server:config.SQL_SERVER,port:config.SQL_PORT,database:config.SQL_DATABASE,connectionTimeout:5000,requestTimeout:10000,pool:{max:10,min:0,idleTimeoutMillis:30000},options:{encrypt:true,trustServerCertificate:false}};
 if(config.SQL_AUTH==='windows') return new native.ConnectionPool({...options,driver:'ODBC Driver 17 for SQL Server',options:{...options.options,trustedConnection:true}}).connect();
 return new sql.ConnectionPool({...options,user:config.SQL_USER,password:config.SQL_PASSWORD}).connect();
 }
 async query<T=Record<string,unknown>>(statement:string,params:Record<string,unknown>={}){const request=(await this.connect()).request();for(const [name,value] of Object.entries(params))request.input(name,value);return request.query<T>(statement);}
 async onModuleDestroy(){if(this.pool)await(await this.pool).close();}
}
