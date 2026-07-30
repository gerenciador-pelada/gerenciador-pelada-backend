import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TrocarJogadoresDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'participanteA deve ser um UUID valido' })
  participanteA: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'participanteB deve ser um UUID valido' })
  participanteB: string;
}
