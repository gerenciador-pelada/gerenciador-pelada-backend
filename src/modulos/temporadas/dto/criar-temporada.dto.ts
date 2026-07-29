import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CriarTemporadaDto {
  @ApiProperty({ example: 'Temporada 2026' })
  @IsString()
  @Length(2, 120, { message: 'nome deve ter entre 2 e 120 caracteres' })
  nome: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'dataInicio deve estar no formato YYYY-MM-DD' })
  dataInicio: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString({}, { message: 'dataFim deve estar no formato YYYY-MM-DD' })
  dataFim: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'ativa deve ser booleano' })
  ativa?: boolean;
}
