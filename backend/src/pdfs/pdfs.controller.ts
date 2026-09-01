import {
  Controller, Post, UseInterceptors, UploadedFile,
  UseGuards, Get, Res, Param, Delete, Patch, Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { createHash } from 'crypto';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB // 10 MB
const ALLOWED_EXTS = ['.pdf', '.xlsx'];
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Rota pública de download/visualização — sem JWT guard
@Controller('pdfs/download')
export class PdfsDownloadController {
  @Get(':filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename — prevent path traversal attacks
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(process.cwd(), 'uploads/pdfs', safeName);

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      const ext = extname(safeName).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext as keyof typeof MIME_TYPES] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found');
    }
  }
}

// Rotas protegidas por JWT
@Controller('pdfs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PdfsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      storage: diskStorage({
        destination: './uploads/pdfs',
        filename: (_req, file, cb) => {
          // Use only timestamp + random — do NOT use original name on disk
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname).toLowerCase();
          cb(null, uniqueSuffix + ext);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        
        if (!ALLOWED_EXTS.includes(ext)) {
          return cb(
            new BadRequestException('Extensão inválida. Use .pdf ou .xlsx') as any,
            false,
          );
        }

        if (file.mimetype !== MIME_TYPES[ext as keyof typeof MIME_TYPES]) {
          return cb(
            new BadRequestException('Tipo de arquivo não corresponde à extensão.') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('subcategoryId') subcategoryId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!subcategoryId) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('A subcategoria é obrigatória.');
    }

    const fileBuffer = fs.readFileSync(file.path);

    const ext = extname(file.originalname).toLowerCase();
    const magicBytes = fileBuffer.slice(0, 4).toString();

    let isValidMagicByte = false;
    if (ext === '.pdf' && magicBytes === '%PDF') isValidMagicByte = true;
    if (ext === '.xlsx' && magicBytes === 'PK\x03\x04') isValidMagicByte = true; // Excel (ZIP)

    if (!isValidMagicByte) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('O arquivo enviado não tem formato válido ou está corrompido.');
    }

    // Verify subcategory exists and belongs to the category
    const subcategory = await this.prisma.subcategory.findUnique({ where: { id: subcategoryId } });
    if (!subcategory) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('Subcategoria inválida.');
    }

    const hash = createHash('sha256').update(fileBuffer).digest('hex');

    const url = `/pdfs/download/${file.filename}`;

    const pdf = await this.prisma.pdf.create({
      data: {
        name: file.originalname,
        hash,
        url,
        category: subcategory.category,
        subcategoryId,
      },
      include: { subcategory: true },
    });

    return { message: 'Upload concluído', pdf };
  }

  @Get()
  async listPdfs() {
    const pdfs = await this.prisma.pdf.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subcategory: true },
    });
    return pdfs.map((pdf) => ({
      id: pdf.id,
      name: pdf.name,
      hash: pdf.hash,
      url_download: pdf.url,
      category: pdf.category,
      subcategoryId: pdf.subcategoryId,
      subcategoryName: pdf.subcategory?.name ?? null,
    }));
  }

  @Patch(':id')
  @Roles('admin')
  async renamePdf(@Param('id') id: string, @Body() body: { name?: string; subcategoryId?: string }) {
    if (body.name !== undefined && body.name.trim().length === 0) {
      throw new BadRequestException('O nome não pode estar vazio.');
    }

    const updateData: any = {};
    if (body.name) updateData.name = body.name.trim();

    if (body.subcategoryId !== undefined) {
      if (body.subcategoryId === null || body.subcategoryId === '') {
        updateData.subcategoryId = null;
        updateData.category = null;
      } else {
        const sub = await this.prisma.subcategory.findUnique({ where: { id: body.subcategoryId } });
        if (!sub) throw new BadRequestException('Subcategoria inválida.');
        updateData.subcategoryId = body.subcategoryId;
        updateData.category = sub.category;
      }
    }

    const pdf = await this.prisma.pdf.update({
      where: { id },
      data: updateData,
      include: { subcategory: true },
    });
    return {
      id: pdf.id,
      name: pdf.name,
      hash: pdf.hash,
      url_download: pdf.url,
      category: pdf.category,
      subcategoryId: pdf.subcategoryId,
      subcategoryName: pdf.subcategory?.name ?? null,
    };
  }

  @Delete(':id')
  @Roles('admin')
  async deletePdf(@Param('id') id: string) {
    const pdf = await this.prisma.pdf.findUnique({ where: { id } });
    if (pdf) {
      const filename = pdf.url.split('/').pop() || '';
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = join(process.cwd(), 'uploads/pdfs', safeName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await this.prisma.pdf.delete({ where: { id } });
    }
    return { message: 'Deleted' };
  }
}
