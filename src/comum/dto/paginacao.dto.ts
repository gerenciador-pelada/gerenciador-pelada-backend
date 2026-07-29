import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginacaoDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pagina deve ser um numero inteiro' })
  @Min(1, { message: 'pagina deve ser no minimo 1' })
  pagina = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limite deve ser um numero inteiro' })
  @Min(1, { message: 'limite deve ser no minimo 1' })
  @Max(100, { message: 'limite deve ser no maximo 100' })
  limite = 20;

  get pular(): number {
    return (this.pagina - 1) * this.limite;
  }
}
