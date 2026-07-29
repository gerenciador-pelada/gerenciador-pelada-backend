import { IsEnum, IsOptional, IsUUID, IsInt } from 'class-validator';
import { TipoEventoPartida } from '../../../comum/enums/tipo-evento-partida.enum';
export class RegistrarEventoPartidaDto {
  @IsEnum(TipoEventoPartida) tipo: TipoEventoPartida;
  @IsUUID('4') participanteId: string;
  @IsOptional() @IsUUID('4') participanteRelacionadoId?: string;
  @IsUUID('4') timeId: string;
  @IsOptional() @IsInt() minuto?: number;
}
