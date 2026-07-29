import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { CriterioDesempate } from '../../../comum/enums/criterio-desempate.enum';
import { FormaEscolhaTimes } from '../../../comum/enums/forma-escolha-times.enum';
import { ModalidadeGoleiro } from '../../../comum/enums/modalidade-goleiro.enum';
import { RegraEmpate } from '../../../comum/enums/regra-empate.enum';

export class AtualizarConfiguracaoDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 11, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'jogadoresLinhaPorTime deve ser inteiro' })
  @Min(1, { message: 'jogadoresLinhaPorTime deve ser no minimo 1' })
  @Max(11, { message: 'jogadoresLinhaPorTime deve ser no maximo 11' })
  jogadoresLinhaPorTime?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 4, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantidadeGoleiros deve ser inteiro' })
  @Min(0, { message: 'quantidadeGoleiros deve ser no minimo 0' })
  @Max(4, { message: 'quantidadeGoleiros deve ser no maximo 4' })
  quantidadeGoleiros?: number;

  @ApiPropertyOptional({ enum: ModalidadeGoleiro })
  @IsOptional()
  @IsEnum(ModalidadeGoleiro, { message: 'modalidadeGoleiro invalida' })
  modalidadeGoleiro?: ModalidadeGoleiro;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'goleirosAlternamTimes deve ser booleano' })
  goleirosAlternamTimes?: boolean;

  @ApiPropertyOptional({ enum: FormaEscolhaTimes })
  @IsOptional()
  @IsEnum(FormaEscolhaTimes, { message: 'formaEscolhaTimesIniciais invalida' })
  formaEscolhaTimesIniciais?: FormaEscolhaTimes;

  @ApiPropertyOptional({ minimum: 2, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maximoJogadores deve ser inteiro' })
  @Min(2, { message: 'maximoJogadores deve ser no minimo 2' })
  maximoJogadores?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 120, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duracaoPartidaMinutos deve ser inteiro' })
  @Min(1, { message: 'duracaoPartidaMinutos deve ser no minimo 1' })
  @Max(120, { message: 'duracaoPartidaMinutos deve ser no maximo 120' })
  duracaoPartidaMinutos?: number;

  @ApiPropertyOptional({ minimum: 1, nullable: true, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maximoGols deve ser inteiro' })
  @Min(1, { message: 'maximoGols deve ser no minimo 1' })
  maximoGols?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'permiteEmpate deve ser booleano' })
  permiteEmpate?: boolean;

  @ApiPropertyOptional({ enum: RegraEmpate })
  @IsOptional()
  @IsEnum(RegraEmpate, { message: 'regraEmpate invalida' })
  regraEmpate?: RegraEmpate;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosVitoria deve ser inteiro' })
  pontosVitoria?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosEmpate deve ser inteiro' })
  pontosEmpate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosDerrota deve ser inteiro' })
  pontosDerrota?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosGol deve ser inteiro' })
  pontosGol?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosAssistencia deve ser inteiro' })
  pontosAssistencia?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosBolaCheia deve ser inteiro' })
  pontosBolaCheia?: number;

  @ApiPropertyOptional({
    example: -1,
    description: 'Use valor negativo para descontar',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosBolaMurcha deve ser inteiro' })
  pontosBolaMurcha?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosPartidaGoleiro deve ser inteiro' })
  pontosPartidaGoleiro?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pontosJogoSemSofrerGol deve ser inteiro' })
  pontosJogoSemSofrerGol?: number;

  @ApiPropertyOptional({ enum: CriterioDesempate, isArray: true })
  @IsOptional()
  @IsArray({ message: 'criteriosDesempateRanking deve ser uma lista' })
  @ArrayMinSize(1, { message: 'informe ao menos um criterio de desempate' })
  @ArrayMaxSize(6, { message: 'informe no maximo seis criterios de desempate' })
  @ArrayUnique({
    message: 'criteriosDesempateRanking nao pode repetir criterios',
  })
  @IsEnum(CriterioDesempate, {
    each: true,
    message: 'criterio de desempate invalido',
  })
  criteriosDesempateRanking?: CriterioDesempate[];
}
