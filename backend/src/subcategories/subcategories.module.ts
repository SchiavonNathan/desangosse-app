import { Module } from '@nestjs/common';
import { SubcategoriesPublicController, SubcategoriesAdminController } from './subcategories.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SubcategoriesPublicController, SubcategoriesAdminController],
})
export class SubcategoriesModule {}
