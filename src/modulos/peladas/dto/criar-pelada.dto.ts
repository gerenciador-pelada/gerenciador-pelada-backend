import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CriarPeladaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'grupoId deve ser um UUID valido' })
  grupoId: string;

  @ApiProperty({ example: '2026-08-05T19:30:00-03:00' })
  @IsDateString({}, { message: 'dataHora deve ser uma data ISO 8601 valida' })
  dataHora: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'localId deve ser um UUID valido' })
  localId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'temporadaId deve ser um UUID valido' })
  temporadaId?: string;
}
