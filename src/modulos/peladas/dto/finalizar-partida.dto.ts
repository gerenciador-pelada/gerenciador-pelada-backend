import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class FinalizarPartidaDto {
  @ApiPropertyOptional({
    enum: ['CASA', 'VISITANTE'],
    description:
      'Obrigatorio quando a partida empata e a regra e DECISAO_IMEDIATA',
  })
  @IsOptional()
  @IsIn(['CASA', 'VISITANTE'], {
    message: 'vencedorDecisao deve ser CASA ou VISITANTE',
  })
  vencedorDecisao?: 'CASA' | 'VISITANTE';

  @ApiPropertyOptional({
    enum: ['CASA', 'VISITANTE'],
    description:
      'Obrigatorio no empate com MAIS_TEMPO_EM_CAMPO_SAI quando os dois times tem o mesmo tempo em campo',
  })
  @IsOptional()
  @IsIn(['CASA', 'VISITANTE'], {
    message: 'escolhaAdmin deve ser CASA ou VISITANTE',
  })
  escolhaAdmin?: 'CASA' | 'VISITANTE';
}
