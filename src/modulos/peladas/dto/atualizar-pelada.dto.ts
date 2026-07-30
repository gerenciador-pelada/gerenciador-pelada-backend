import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AtualizarPeladaDto {
  @ApiPropertyOptional({ example: '2026-08-05T19:30:00-03:00' })
  @IsOptional()
  @IsDateString({}, { message: 'dataHora deve ser uma data ISO 8601 valida' })
  dataHora?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'localId deve ser um UUID valido' })
  localId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'temporadaId deve ser um UUID valido' })
  temporadaId?: string | null;
}
