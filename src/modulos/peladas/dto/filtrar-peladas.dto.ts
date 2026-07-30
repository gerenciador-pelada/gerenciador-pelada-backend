import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginacaoDto } from '../../../comum/dto/paginacao.dto';
import { StatusPelada } from '../../../comum/enums/status-pelada.enum';

export class FiltrarPeladasDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'grupoId deve ser um UUID valido' })
  grupoId?: string;

  @ApiPropertyOptional({ enum: StatusPelada })
  @IsOptional()
  @IsEnum(StatusPelada, { message: 'status invalido' })
  status?: StatusPelada;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'localId deve ser um UUID valido' })
  localId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'temporadaId deve ser um UUID valido' })
  temporadaId?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve estar no formato YYYY-MM-DD' })
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve estar no formato YYYY-MM-DD' })
  dataFim?: string;
}
