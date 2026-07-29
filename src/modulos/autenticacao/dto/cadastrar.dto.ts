import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class CadastrarDto {
  @ApiProperty({ example: 'Lucas Alexandre' })
  @IsString()
  @Length(3, 120, { message: 'nome deve ter entre 3 e 120 caracteres' })
  nome: string;

  @ApiProperty({ example: 'organizador@pelada.com' })
  @IsEmail({}, { message: 'email invalido' })
  email: string;

  @ApiProperty({ example: 'senhaSegura123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'senha deve ter no minimo 8 caracteres' })
  senha: string;
}
