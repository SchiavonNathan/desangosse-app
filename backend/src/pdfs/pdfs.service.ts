import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

@Injectable()
export class PdfsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const uploadDir = join(process.cwd(), 'uploads/pdfs');
    
    // Check if directory exists
    if (!fs.existsSync(uploadDir)) {
      return;
    }

    const filesOnDisk = fs.readdirSync(uploadDir);
    
    if (filesOnDisk.length === 0) return;

    // Fetch all PDFs from database
    const dbPdfs = await this.prisma.pdf.findMany();
    
    // We compare based on the filename extracted from the URL
    const dbFilenames = dbPdfs.map(pdf => pdf.url.split('/').pop());

    for (const file of filesOnDisk) {
      if (!dbFilenames.includes(file)) {
        // File is on disk but not in DB. Let's register it!
        const filePath = join(uploadDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const hash = createHash('md5').update(fileBuffer).digest('hex');
        
        const port = process.env.PORT ?? 3001;
        const url = `http://localhost:${port}/pdfs/download/${file}`;

        await this.prisma.pdf.create({
          data: {
            name: file, // we don't have the original name anymore, so we use the disk filename
            hash,
            url,
            subcategoryId: null,
          }
        });
        console.log(`[PdfsService] Arquivo restaurado para o banco de dados: ${file}`);
      }
    }
  }
}
