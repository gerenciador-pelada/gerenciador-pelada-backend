import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BancoModule } from './banco/banco.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), BancoModule],
})
export class AppModule {}
