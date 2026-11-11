import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

// QR code em SVG (sem imagem externa e sem HTML solto): o aplicativo de autenticação lê e adiciona a conta.
// Fundo branco e módulos pretos fixos, com margem de 4 módulos, para ler bem em qualquer tema.
const MARGEM = 4;

export function CodigoQr({ texto, rotulo }: { texto: string; rotulo: string }) {
  const { tamanho, caminho } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let l = 0; l < n; l++)
      for (let c = 0; c < n; c++) if (qr.isDark(l, c)) d += `M${c + MARGEM},${l + MARGEM}h1v1h-1z`;
    return { tamanho: n + MARGEM * 2, caminho: d };
  }, [texto]);
  return (
    <svg
      role="img"
      aria-label={rotulo}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      width="220"
      height="220"
      style={{ maxWidth: '100%', height: 'auto', background: '#fff', borderRadius: 8 }}
      shapeRendering="crispEdges"
    >
      <rect width={tamanho} height={tamanho} fill="#fff" />
      <path d={caminho} fill="#000" />
    </svg>
  );
}
