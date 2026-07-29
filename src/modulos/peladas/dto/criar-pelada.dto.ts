import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CriarPeladaDto {
  @ApiProperty({ example: 'Pelada de quarta' })
  @IsString()
  @Length(2, 120, { message: 'nome deve ter entre 2 e 120 caracteres' })
  nome: string;

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
