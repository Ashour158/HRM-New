import { Module } from '@nestjs/common';
import { PlatformModule } from '../../platform/platform.module.js';
import { AdminModuleOperationsCommandHandler } from './admin-module-operations-command.handler.js';
import { AdminModuleOperationsController } from './admin-module-operations.controller.js';
import { AdminModuleOperationsRepository } from './admin-module-operations.repository.js';
import { NativeModuleOperationAdapterService } from './native-module-operation-adapter.service.js';

@Module({
  imports: [PlatformModule],
  controllers: [AdminModuleOperationsController],
  providers: [AdminModuleOperationsRepository, NativeModuleOperationAdapterService, AdminModuleOperationsCommandHandler],
  exports: [AdminModuleOperationsRepository, NativeModuleOperationAdapterService],
})
export class AdminModuleOperationsModule {}
