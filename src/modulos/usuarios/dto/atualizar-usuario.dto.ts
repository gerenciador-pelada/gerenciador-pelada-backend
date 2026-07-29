import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PerfilUsuario } from '../../../comum/enums/perfil-usuario.enum';

export class AtualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Lucas Alexandre' })
  @IsOptional()
  @IsString()
  @Length(3, 120, { message: 'nome deve ter entre 3 e 120 caracteres' })
  nome?: string;

  @ApiPropertyOptional({ enum: PerfilUsuario })
  @IsOptional()
  @IsEnum(PerfilUsuario, { message: 'perfil invalido' })
  perfil?: PerfilUsuario;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'ativo deve ser booleano' })
  ativo?: boolean;
}
