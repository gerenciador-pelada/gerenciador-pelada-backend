import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Conta as requisicoes pelo IP real de quem chamou, e nao pelo do proxy.
 *
 * Atras de um tunel (cloudflared) todo o trafego chega da propria maquina, e
 * `req.ip` e sempre 127.0.0.1. Com isso o limite viraria um balde unico
 * compartilhado por todos: qualquer pessoa martelando o login gastaria a cota
 * e deixaria o organizador de fora — o limite protegeria contra forca bruta
 * criando uma negacao de servico trivial no lugar.
 *
 * `CF-Connecting-IP` e escrito pela Cloudflare e nao pode ser forjado por
 * quem passa pelo tunel: a borda sobrescreve o que o cliente mandar. Quem
 * chega direto na porta, sem tunel, cai no `req.ip` de sempre.
 */
@Injectable()
export class ThrottlerAtrasDeProxy extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const cabecalho = req.headers['cf-connecting-ip'];
    const real = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
    return Promise.resolve(real?.trim() ?? req.ip ?? 'desconhecido');
  }
}
