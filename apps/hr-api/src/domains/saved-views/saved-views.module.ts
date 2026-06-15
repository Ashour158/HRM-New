import { Module } from '@nestjs/common';
import { SavedViewsController } from './api/saved-views.controller.js';
import { SavedViewsRepository } from './repositories/saved-views.repository.js';

@Module({
  controllers: [SavedViewsController],
  providers: [SavedViewsRepository],
  exports: [SavedViewsRepository],
})
export class SavedViewsModule {}
