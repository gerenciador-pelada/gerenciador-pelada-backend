import { SetMetadata } from '@nestjs/common';

export const CHAVE_PUBLICO = 'rota_publica';

/** Marca uma rota como acessivel sem token. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
