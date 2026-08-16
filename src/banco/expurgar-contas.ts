import {
  DIAS_ATE_EXPURGO,
  expurgarContasVencidas,
  listarContasVencidas,
} from '../modulos/usuarios/expurgo-contas';
import { fonteDados } from './fonte-dados';

/**
 * Apaga de vez as contas excluidas ha mais de trinta dias.
 *
 *     npm run contas:expurgar -- --simular   # so lista, nao apaga
 *     npm run contas:expurgar                # apaga
 *
 * Comeca simulando de proposito nas maos de quem esta lendo isto pela primeira
 * vez: o comando apaga sem volta, e a lista impressa e a ultima chance de
 * perceber que o banco apontado nao era o que se pensava.
 */
async function principal(): Promise<void> {
  const simular = process.argv.includes('--simular');

  await fonteDados.initialize();
  try {
    const vencidas = await listarContasVencidas(fonteDados.manager);

    if (vencidas.length === 0) {
      console.log(
        `Nenhuma conta excluida ha mais de ${DIAS_ATE_EXPURGO} dias.`,
      );
      return;
    }

    console.log(
      `${vencidas.length} conta(s) excluida(s) ha mais de ${DIAS_ATE_EXPURGO} dias:`,
    );
    for (const id of vencidas) console.log(`  ${id}`);

    if (simular) {
      console.log('\n--simular: nada foi apagado.');
      return;
    }

    const resultado = await expurgarContasVencidas(fonteDados);
    console.log(`\nExpurgadas: ${resultado.expurgadas.length}`);
    for (const falha of resultado.falhas) {
      console.error(`  FALHOU ${falha.usuarioId}: ${falha.motivo}`);
    }
    // Sai com erro se alguma falhou: e o que faz um agendador avisar em vez de
    // registrar sucesso sobre um expurgo que nao aconteceu.
    if (resultado.falhas.length > 0) process.exitCode = 1;
  } finally {
    await fonteDados.destroy();
  }
}

void principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
