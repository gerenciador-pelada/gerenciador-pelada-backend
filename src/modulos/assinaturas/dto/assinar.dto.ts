import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import type { CodigoPlano } from '../planos';

export class AssinarDto {
  @ApiProperty({ example: '12345678909', description: 'CPF ou CNPJ' })
  @IsString({ message: 'cpfCnpj deve ser texto' })
  @Length(11, 18, { message: 'cpfCnpj deve ter entre 11 e 18 caracteres' })
  cpfCnpj: string;

  // So o plano. O valor NAO entra por aqui: aceitar preco do cliente deixava
  // qualquer um assinar por um real mandando outro numero no corpo.
  @ApiProperty({ enum: ['MENSAL', 'ANUAL'] })
  @IsIn(['MENSAL', 'ANUAL'], { message: 'plano deve ser MENSAL ou ANUAL' })
  plano: CodigoPlano;
}
