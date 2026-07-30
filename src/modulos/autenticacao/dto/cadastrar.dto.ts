import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

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

  /**
   * Opcional no DTO, exigido no service: quando nao ha convite configurado o
   * cadastro esta fechado, e recusar por "convite invalido" contaria que o
   * campo existe. A checagem de verdade fica num lugar so.
   */
  @ApiProperty({ required: false, description: 'Codigo de convite' })
  @IsOptional()
  @IsString()
  convite?: string;
}
