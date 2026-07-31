import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class DefinirValorCampoDto {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Custo do campo em CENTAVOS. Null limpa o valor.',
  })
  @IsOptional()
  @IsInt({ message: 'valorCampoCentavos deve ser um numero inteiro de centavos' })
  @Min(0, { message: 'valorCampoCentavos nao pode ser negativo' })
  valorCampoCentavos?: number | null;

  @ApiPropertyOptional({ description: 'Se o goleiro fixo entra no rateio' })
  @IsOptional()
  @IsBoolean({ message: 'goleiroFixoPaga deve ser booleano' })
  goleiroFixoPaga?: boolean;
}

export class MarcarPagamentoDto {
  @IsBoolean({ message: 'pagou deve ser booleano' })
  pagou: boolean;
}
