import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  BadRequestException, NotFoundException,
  UseInterceptors, UploadedFile, Res
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const MAX_ICON_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---- Public controller (listing) ----
@Controller('subcategories')
export class SubcategoriesPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('category') category?: string) {
    const where = category ? { category } : undefined;
    return this.prisma.subcategory.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { pdfs: true } } },
    });
  }

  @Get('icon/:filename')
  serveIcon(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(process.cwd(), 'uploads/icons', safeName);

    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(filePath);
    } else {
      res.status(404).send('Icon not found');
    }
  }
}

// ---- Protected controller (admin CRUD) ----
@Controller('subcategories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcategoriesAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('icon', {
      limits: { fileSize: MAX_ICON_SIZE },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads/icons');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, './uploads/icons');
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, uniqueSuffix + extname(file.originalname).toLowerCase());
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Formato de imagem inválido. Apenas JPG, PNG e WebP.') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Body() body: { name: string; category: string },
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    const name = body.name?.trim();
    const category = body.category?.trim();

    if (!name) {
      if (icon) fs.unlinkSync(icon.path);
      throw new BadRequestException('O nome da subcategoria é obrigatório.');
    }
    if (!category) {
      if (icon) fs.unlinkSync(icon.path);
      throw new BadRequestException('A categoria é obrigatória.');
    }

    const existing = await this.prisma.subcategory.findUnique({
      where: { name_category: { name, category } },
    });
    if (existing) {
      if (icon) fs.unlinkSync(icon.path);
      throw new BadRequestException('Já existe uma subcategoria com esse nome nessa categoria.');
    }

    let iconUrl: string | null = null;
    if (icon) {
      const port = process.env.PORT ?? 3001;
      iconUrl = `http://localhost:${port}/subcategories/icon/${icon.filename}`;
    }

    return this.prisma.subcategory.create({ data: { name, category, iconUrl } });
  }

  @Patch(':id')
  @Roles('admin')
  async rename(@Param('id') id: string, @Body() body: { name: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('O nome não pode estar vazio.');

    const sub = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subcategoria não encontrada.');

    // Check for name conflict in same category
    const conflict = await this.prisma.subcategory.findUnique({
      where: { name_category: { name, category: sub.category } },
    });
    if (conflict && conflict.id !== id) throw new BadRequestException('Já existe uma subcategoria com esse nome nessa categoria.');

    return this.prisma.subcategory.update({ where: { id }, data: { name } });
  }

  @Patch(':id/icon')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('icon', {
      limits: { fileSize: MAX_ICON_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads/icons');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, './uploads/icons');
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, uniqueSuffix + extname(file.originalname).toLowerCase());
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Formato de imagem inválido. Apenas JPG, PNG e WebP.') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async updateIcon(
    @Param('id') id: string,
    @UploadedFile() icon: Express.Multer.File,
  ) {
    if (!icon) throw new BadRequestException('Nenhuma imagem enviada.');

    const sub = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!sub) {
      fs.unlinkSync(icon.path);
      throw new NotFoundException('Subcategoria não encontrada.');
    }

    // Remove old icon if exists
    if (sub.iconUrl) {
      const oldFilename = sub.iconUrl.split('/').pop() || '';
      const safeName = oldFilename.replace(/[^a-zA-Z0-9._-]/g, '');
      const oldPath = join(process.cwd(), 'uploads/icons', safeName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const port = process.env.PORT ?? 3001;
    const iconUrl = `http://localhost:${port}/subcategories/icon/${icon.filename}`;

    return this.prisma.subcategory.update({ where: { id }, data: { iconUrl } });
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    const sub = await this.prisma.subcategory.findUnique({
      where: { id },
      include: { _count: { select: { pdfs: true } } },
    });
    if (!sub) throw new NotFoundException('Subcategoria não encontrada.');
    if (sub._count.pdfs > 0) {
      throw new BadRequestException(
        `Não é possível excluir: existem ${sub._count.pdfs} PDF(s) vinculados a esta subcategoria.`,
      );
    }

    // Remover ícone se existir
    if (sub.iconUrl) {
      const filename = sub.iconUrl.split('/').pop() || '';
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = join(process.cwd(), 'uploads/icons', safeName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.subcategory.delete({ where: { id } });
    return { message: 'Subcategoria excluída.' };
  }
}
