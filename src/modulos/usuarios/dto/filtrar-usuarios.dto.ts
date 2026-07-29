import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginacaoDto } from '../../../comum/dto/paginacao.dto';
import { PerfilUsuario } from '../../../comum/enums/perfil-usuario.enum';

export class FiltrarUsuariosDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome ou e-mail' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: PerfilUsuario })
  @IsOptional()
  @IsEnum(PerfilUsuario, { message: 'perfil invalido' })
  perfil?: PerfilUsuario;
}
