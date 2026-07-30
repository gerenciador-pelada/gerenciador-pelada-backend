import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class DefinirGoleiroDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Participante que vai para o gol. Omita para deixar sem goleiro.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'participanteId deve ser um UUID valido' })
  participanteId?: string | null;
}
