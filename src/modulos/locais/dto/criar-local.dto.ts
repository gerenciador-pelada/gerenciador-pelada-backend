import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CriarLocalDto {
  @ApiProperty({ example: 'Quadra do Bairro' })
  @IsString()
  @Length(2, 120, { message: 'nome deve ter entre 2 e 120 caracteres' })
  nome: string;

  @ApiPropertyOptional({ example: 'Rua das Palmeiras, 100' })
  @IsOptional()
  @IsString()
  @Length(1, 250, { message: 'endereco deve ter no maximo 250 caracteres' })
  endereco?: string;
}
