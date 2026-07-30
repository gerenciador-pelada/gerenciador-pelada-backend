import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class FinalizarPeladaDto {
  @ApiPropertyOptional({ enum: ['CASA', 'VISITANTE'] })
  @IsOptional()
  @IsIn(['CASA', 'VISITANTE'], {
    message: 'vencedorDecisao deve ser CASA ou VISITANTE',
  })
  vencedorDecisao?: 'CASA' | 'VISITANTE';
}
