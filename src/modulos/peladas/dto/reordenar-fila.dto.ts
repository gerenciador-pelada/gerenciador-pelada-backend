import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class ReordenarFilaDto {
  @ApiProperty({
    type: [String],
    description: 'A fila inteira na ordem desejada. Posicao 1 entra primeiro.',
  })
  // `IsArray` antes do `each`: sem ele um valor escalar atravessa a validacao
  // e o servico passa a tratar a string como colecao, comparando tamanhos que
  // nao significam nada. Falha silenciosa, e a fila sai errada.
  @IsArray({ message: 'participanteIds deve ser uma lista' })
  @IsUUID('4', { each: true, message: 'participanteIds deve conter UUIDs' })
  participanteIds: string[];
}

export class AdicionarNaFilaDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Onde entrar na fila. 1 e o proximo. Ausente = fim da fila.',
  })
  @IsOptional()
  @IsInt({ message: 'posicao deve ser um numero inteiro' })
  @Min(1, { message: 'posicao deve ser no minimo 1' })
  posicao?: number;
}

export class EntrarNoLugarDeDto {
  @ApiProperty({ description: 'Quem sai do time e volta para a fila' })
  @IsUUID('4', { message: 'saiId deve ser um UUID' })
  saiId: string;
}

export class CompletarTimeDto {
  @ApiProperty({ description: 'Time que esta com vaga aberta' })
  @IsUUID('4', { message: 'timeId deve ser um UUID' })
  timeId: string;
}
