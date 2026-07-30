import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SubstituirJogadorDto {
  @ApiProperty({ format: 'uuid', description: 'Participante que sai de campo' })
  @IsUUID('4', { message: 'saiId deve ser um UUID valido' })
  saiId: string;

  @ApiProperty({ format: 'uuid', description: 'Participante que entra' })
  @IsUUID('4', { message: 'entraId deve ser um UUID valido' })
  entraId: string;
}
