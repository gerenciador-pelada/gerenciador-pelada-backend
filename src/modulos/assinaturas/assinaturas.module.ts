import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssinaturaEntity } from '../../banco/entidades/assinatura.entity';
import { UsuarioEntity } from '../../banco/entidades/usuario.entity';
import { AssinaturasController } from './assinaturas.controller';
import { AssinaturasService } from './assinaturas.service';
import { ClienteAsaas } from './cliente-asaas';

@Module({
  imports: [TypeOrmModule.forFeature([AssinaturaEntity, UsuarioEntity])],
  controllers: [AssinaturasController],
  providers: [AssinaturasService, ClienteAsaas],
  exports: [AssinaturasService],
})
export class AssinaturasModule {}
