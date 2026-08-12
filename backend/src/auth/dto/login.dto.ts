import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'O usuário deve ser uma string' })
  @MinLength(3, { message: 'O usuário deve ter no mínimo 3 caracteres' })
  @MaxLength(64, { message: 'O usuário deve ter no máximo 64 caracteres' })
  username: string;

  @IsString({ message: 'A senha deve ser uma string' })
  @MinLength(1, { message: 'A senha é obrigatória' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres' })
  password: string;
}
