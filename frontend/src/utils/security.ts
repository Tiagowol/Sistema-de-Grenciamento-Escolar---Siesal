/**
 * Verificação de senha contra bases de VAZAMENTOS DE DADOS (v2).
 *
 * Usa a API Pwned Passwords do HaveIBeenPwned (https://haveibeenpwned.com)
 * com o modelo de privacidade "k-anonymity": apenas os 5 primeiros caracteres
 * do hash SHA-1 da senha são enviados ao serviço — a senha completa NUNCA sai
 * do computador do usuário. O retorno informa se a senha já apareceu em
 * vazamentos conhecidos e quantas vezes.
 *
 * Se o serviço estiver indisponível (offline/erro), devolve null e o fluxo
 * de cadastro continua normalmente (a verificação nunca bloqueia por falha).
 */

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface BreachCheckResult {
  /** true = a senha já apareceu em vazamentos conhecidos */
  breached: boolean;
  /** Quantas vezes a senha apareceu nos vazamentos indexados */
  count: number;
}

export async function checkPasswordBreach(password: string): Promise<BreachCheckResult | null> {
  try {
    const hash = (await sha1Hex(password)).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!res.ok) return null;

    const body = await res.text();

    for (const line of body.split('\n')) {
      const [lineSuffix, countStr] = line.trim().split(':');
      if (lineSuffix === suffix) {
        return { breached: true, count: Number(countStr) || 0 };
      }
    }

    return { breached: false, count: 0 };
  } catch {
    // Serviço indisponível — não bloquear o cadastro por causa da verificação
    return null;
  }
}
