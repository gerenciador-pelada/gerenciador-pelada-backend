import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class LinhaLancamentoDto {
  @ApiProperty()
  @IsUUID('4', { message: 'jogadorId deve ser um UUID' })
  jogadorId: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'gols deve ser inteiro' })
  @Min(0, { message: 'gols nao pode ser negativo' })
  gols?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'assistencias deve ser inteiro' })
  @Min(0, { message: 'assistencias nao pode ser negativo' })
  assistencias?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'bolasCheias deve ser inteiro' })
  @Min(0, { message: 'bolasCheias nao pode ser negativo' })
  bolasCheias?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'bolasMurchas deve ser inteiro' })
  @Min(0, { message: 'bolasMurchas nao pode ser negativo' })
  bolasMurchas?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'pontos deve ser inteiro' })
  @Min(0, { message: 'pontos nao pode ser negativo' })
  pontos?: number;
}

export class LancamentoManualDto {
  @ApiProperty({ type: [LinhaLancamentoDto] })
  @IsArray({ message: 'jogadores deve ser uma lista' })
  @ArrayNotEmpty({ message: 'informe ao menos um jogador' })
  @ValidateNested({ each: true })
  @Type(() => LinhaLancamentoDto)
  jogadores: LinhaLancamentoDto[];
}
