export interface PortalIdentity {id:string;name:string;permissions:readonly string[];}
export interface CatalogEntry {id:string;name:string;description:string;route:string;code:string;}
export type InstallationState='QUARANTINE'|'VALIDATED'|'REJECTED'|'APPROVED'|'DEPLOYED'|'PUBLISHED'|'DISABLED';
export interface DataScope {type:'area'|'department'|'team';id:string;}
