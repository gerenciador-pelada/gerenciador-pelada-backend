import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { PosicaoJogador } from '../../../comum/enums/posicao-jogador.enum';

export class CriarJogadorDto {
  @ApiProperty({ example: 'Lucas Alexandre' })
  @IsString()
  @Length(2, 120, { message: 'nome deve ter entre 2 e 120 caracteres' })
  nome: string;

  @ApiPropertyOptional({ example: 'Lucao' })
  @IsOptional()
  @IsString()
  @Length(1, 60, { message: 'apelido deve ter no maximo 60 caracteres' })
  apelido?: string;

  @ApiPropertyOptional({ example: 'https://exemplo.com/foto.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'fotoUrl deve ser uma URL valida' })
  fotoUrl?: string;

  @ApiPropertyOptional({ enum: PosicaoJogador, default: PosicaoJogador.LINHA })
  @IsOptional()
  @IsEnum(PosicaoJogador, { message: 'posicaoPreferida invalida' })
  posicaoPreferida?: PosicaoJogador;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'podeSerGoleiro deve ser booleano' })
  podeSerGoleiro?: boolean;
}
