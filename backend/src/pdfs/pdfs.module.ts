import { Module } from '@nestjs/common';
import { PdfsService } from './pdfs.service';
import { PdfsController, PdfsDownloadController } from './pdfs.controller';

@Module({
  providers: [PdfsService],
  controllers: [PdfsController, PdfsDownloadController]
})
export class PdfsModule {}
