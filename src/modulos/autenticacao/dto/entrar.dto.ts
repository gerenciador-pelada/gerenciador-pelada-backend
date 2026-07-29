import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class EntrarDto {
  @ApiProperty({ example: 'organizador@pelada.com' })
  @IsEmail({}, { message: 'email invalido' })
  email: string;

  @ApiProperty({ example: 'senhaSegura123' })
  @IsString()
  @MinLength(8, { message: 'senha deve ter no minimo 8 caracteres' })
  senha: string;
}
