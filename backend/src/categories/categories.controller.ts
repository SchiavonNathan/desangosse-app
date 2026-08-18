import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('categories')
export class CategoriesController {
  @Post(':name/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads/categories');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, './uploads/categories');
        },
        filename: (req, file, cb) => {
          const nameParam = String(req.params.name);
          const safeName = nameParam.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
          cb(null, `${safeName}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Formato inválido. Use JPG, PNG ou WebP.') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Param('name') name: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhuma imagem enviada.');
    
    const port = process.env.PORT ?? 3000;
    const imageUrl = `http://localhost:${port}/categories/image/${file.filename}`;
    
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const uploadDir = join(process.cwd(), 'uploads/categories');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      files.forEach((f) => {
        if (f.startsWith(safeName + '.') && f !== file.filename) {
          fs.unlinkSync(join(uploadDir, f));
        }
      });
    }

    return { message: 'Imagem atualizada', imageUrl };
  }

  @Get('image/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(process.cwd(), 'uploads/categories', safeName);

    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.sendFile(filePath);
    } else {
      res.status(404).send('Image not found');
    }
  }

  @Get('find-image/:name')
  findImage(@Param('name') name: string, @Res() res: Response) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const uploadDir = join(process.cwd(), 'uploads/categories');
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const found = files.find((f) => f.startsWith(safeName + '.'));
      if (found) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.sendFile(join(uploadDir, found));
        return;
      }
    }
    res.status(404).send('Image not found');
  }
}
