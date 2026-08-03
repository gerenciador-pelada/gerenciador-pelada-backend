import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Length, Min } from 'class-validator';

export class AssinarDto {
  @ApiProperty({ example: '12345678909', description: 'CPF ou CNPJ' })
  @IsString({ message: 'cpfCnpj deve ser texto' })
  @Length(11, 18, { message: 'cpfCnpj deve ter entre 11 e 18 caracteres' })
  cpfCnpj: string;

  // Em centavos, como todo dinheiro do projeto. Minimo de R$ 1,00: o Asaas
  // recusa valores menores, e falhar aqui da mensagem melhor que falhar la.
  @ApiProperty({ example: 1990, description: 'Valor em centavos' })
  @IsInt({ message: 'valorCentavos deve ser inteiro' })
  @Min(100, { message: 'valorCentavos deve ser ao menos 100 (R$ 1,00)' })
  valorCentavos: number;

  @ApiProperty({ enum: ['MONTHLY', 'YEARLY'] })
  @IsIn(['MONTHLY', 'YEARLY'], { message: 'ciclo deve ser MONTHLY ou YEARLY' })
  ciclo: 'MONTHLY' | 'YEARLY';
}
