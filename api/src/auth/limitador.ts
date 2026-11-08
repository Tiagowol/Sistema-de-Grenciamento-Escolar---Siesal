// Limite de tentativas por chave (ex.: endereço IP) em janela fixa. Em memória, por processo (ADR-005):
// com mais de uma instância da api, evoluir para tabela ou cache compartilhado.
export class LimitadorJanela {
  private readonly janelas = new Map<string, { inicio: number; total: number }>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
  ) {}

  // Conta a tentativa e diz se ainda é permitida
  permitir(chave: string, agora = Date.now()): boolean {
    const atual = this.janelas.get(chave);
    if (!atual || agora - atual.inicio >= this.janelaMs) {
      this.janelas.set(chave, { inicio: agora, total: 1 });
      this.limpar(agora);
      return true;
    }
    atual.total += 1;
    return atual.total <= this.maximo;
  }

  private limpar(agora: number): void {
    if (this.janelas.size < 1000) return;
    for (const [chave, janela] of this.janelas)
      if (agora - janela.inicio >= this.janelaMs) this.janelas.delete(chave);
  }
}
