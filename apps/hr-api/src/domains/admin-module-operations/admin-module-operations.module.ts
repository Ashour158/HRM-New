import { Module } from '@nestjs/common';
import { AdminModuleOperationsController } from './admin-module-operations.controller.js';
import { AdminModuleOperationsRepository } from './admin-module-operations.repository.js';
import { NativeModuleOperationAdapterService } from './native-module-operation-adapter.service.js';

@Module({
  controllers: [AdminModuleOperationsController],
  providers: [AdminModuleOperationsRepository, NativeModuleOperationAdapterService],
  exports: [AdminModuleOperationsRepository, NativeModuleOperationAdapterService],
})
export class AdminModuleOperationsModule {}
