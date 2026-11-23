import {TlvBasesController} from './admin/tlv-bases.controller.js';
import {PackageRuntimeController} from './modules/runtime.controller.js';
import { OffersController } from './business/offers.controller.js';
import {EnrollmentService} from './security/enrollment.service.js';
import { BusinessController } from './business/business.controller.js';
import {EnrollmentController} from './security/enrollment.controller.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { Module,Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Database } from './database.js';
import { AuthService } from './security/auth.service.js';
import { SessionGuard } from './security/guard.js';
import { AuthController } from './security/auth.controller.js';
import { OidcProvider } from './security/oidc.js';
import { CatalogController } from './catalog/catalog.controller.js';
@Global() @Module({providers:[Database,AuthService],exports:[Database,AuthService]}) class CoreDataModule {}
@Module({imports:[CoreDataModule],controllers:[AuthController,EnrollmentController],providers:[OidcProvider,EnrollmentService]}) class IdentityModule {}
@Module({imports:[CoreDataModule],controllers:[CatalogController,BusinessController,OffersController,PackageRuntimeController]}) class CatalogModule {}
@Module({imports:[CoreDataModule],controllers:[AdminController,TlvBasesController],providers:[AdminService]}) class AdministrationModule {}
@Module({imports:[CoreDataModule,IdentityModule,CatalogModule,AdministrationModule],providers:[{provide:APP_GUARD,useClass:SessionGuard}]}) export class AppModule {}
