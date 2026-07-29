import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginacaoDto } from '../../../comum/dto/paginacao.dto';
import { PosicaoJogador } from '../../../comum/enums/posicao-jogador.enum';

export class FiltrarJogadoresDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome ou apelido' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: PosicaoJogador })
  @IsOptional()
  @IsEnum(PosicaoJogador, { message: 'posicaoPreferida invalida' })
  posicaoPreferida?: PosicaoJogador;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  podeSerGoleiro?: boolean;
}
