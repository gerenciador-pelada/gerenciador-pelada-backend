import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
export class ReordenarChegadaDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  participanteIds: string[];
}
