import assert from 'node:assert/strict';
import test from 'node:test';

import { lerConfiguracaoJwt } from './configuracao.ts';

test('usa validade longa por padrao para tokens JWT', () => {
  const anterior = process.env.JWT_EXPIRACAO;
  const segredoAnterior = process.env.JWT_SEGREDO;
  delete process.env.JWT_EXPIRACAO;
  process.env.JWT_SEGREDO = 'a'.repeat(32);

  try {
    assert.equal(lerConfiguracaoJwt().expiracao, '30d');
  } finally {
    if (anterior === undefined) delete process.env.JWT_EXPIRACAO;
    else process.env.JWT_EXPIRACAO = anterior;
    if (segredoAnterior === undefined) delete process.env.JWT_SEGREDO;
    else process.env.JWT_SEGREDO = segredoAnterior;
  }
});
