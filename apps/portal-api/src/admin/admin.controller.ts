import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Put,Req } from '@nestjs/common';
import { ArrayMaxSize,ArrayUnique,IsArray,IsBoolean,IsInt,IsString,IsUUID,Length,Matches,MaxLength,Min,IsIn,IsOptional } from 'class-validator';
import { Permission,type SessionRequest } from '../security/guard.js';
import { AdminService } from './admin.service.js';
class ReasonDto {@IsString() @Length(5,500) @Matches(/\S/) reason!:string;}
class ModuleDto extends ReasonDto {@IsIn(['install','publish','disable']) action!:'install'|'publish'|'disable'; @IsOptional() @IsString() @MaxLength(8192) manifest?:string;}
class VersionDto extends ReasonDto {@IsInt() @Min(1) version!:number;}
class RoleDto extends ReasonDto {@IsString() @Length(1,120) @Matches(/\S/) name!:string; @IsString() @MaxLength(500) description!:string; @IsBoolean() enabled!:boolean;}
class CreateRoleDto extends RoleDto {@IsString() @Matches(/^[A-Z][A-Z0-9_]{2,99}$/) code!:string;}
class EditRoleDto extends RoleDto {@IsInt() @Min(1) version!:number;}
class PermissionsDto extends VersionDto {@IsArray() @ArrayUnique() @ArrayMaxSize(200) @IsString({each:true}) @Matches(/^[A-Z][A-Z0-9_.]{2,149}$/,{each:true}) permissions!:string[];}
class RolesDto extends VersionDto {@IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsUUID('all',{each:true}) roles!:string[];}
class StatusDto extends VersionDto {@IsBoolean() enabled!:boolean;}
class CreateUserDto extends ReasonDto {
 @IsString() @Length(3,128) @Matches(/^[a-zA-Z0-9][a-zA-Z0-9@._-]*$/) username!:string;
 @IsString() @Length(1,120) @Matches(/\S/) name!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsUUID('all',{each:true}) roles!:string[];
}
@Controller('admin')
export class AdminController {
 constructor(private service:AdminService){}
 @Get('modules') @Permission('CORE.MODULES.READ') modules(@Req() r:SessionRequest){return this.service.moduleList(r);}
 @Post('modules') @Permission('CORE.MODULES.MANAGE') moduleChange(@Req() r:SessionRequest,@Body() b:ModuleDto){return this.service.manageModule(r,b);}
 @Get('roles') @Permission('CORE.ROLES.READ') roles(@Req() r:SessionRequest){return this.service.read(r,'roles');}
 @Post('users') @Permission('CORE.USERS.CREATE') createUser(@Req() r:SessionRequest,@Body() b:CreateUserDto){return this.service.createUser(r,b);}
 @Post('users/:id/invitation') @Permission('CORE.USERS.CREATE') renew(@Req() r:SessionRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() b:VersionDto){return this.service.renewInvitation(r,id,b.version,b.reason);}
 @Get('users') @Permission('CORE.USERS.READ') users(@Req() r:SessionRequest){return this.service.read(r,'users');}
 @Post('roles') @Permission('CORE.ROLES.MANAGE') create(@Req() r:SessionRequest,@Body() b:CreateRoleDto){return this.service.saveRole(r,undefined,b);}
 @Patch('roles/:id') @Permission('CORE.ROLES.MANAGE') role(@Req() r:SessionRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() b:EditRoleDto){return this.service.saveRole(r,id,b);}
 @Put('roles/:id/permissions') @Permission('CORE.PERMISSIONS.ASSIGN') permissions(@Req() r:SessionRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() b:PermissionsDto){return this.service.permissions(r,id,b.permissions,b.version,b.reason);}
 @Put('users/:id/roles') @Permission('CORE.USERS.ROLES_ASSIGN') assignments(@Req() r:SessionRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() b:RolesDto){return this.service.user(r,id,b.version,b.reason,{roles:b.roles});}
 // Enabling and disabling require different permissions, rechecked within the transaction.
 @Patch('users/:id/status') @Permission('CORE.USERS.READ') status(@Req() r:SessionRequest,@Param('id',new ParseUUIDPipe()) id:string,@Body() b:StatusDto){return this.service.user(r,id,b.version,b.reason,{enabled:b.enabled});}
}
