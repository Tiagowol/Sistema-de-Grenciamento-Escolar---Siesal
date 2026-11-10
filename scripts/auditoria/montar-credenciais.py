# Monta o arquivo de acesso da auditoria (fora do git). Não imprime senha.
import json, sys
url, fim, saida = sys.argv[1], sys.argv[2], sys.argv[3]
contas = json.load(open('out/auditoria.json', encoding='utf-8'))
rot = {'aluno': 'Aluno', 'professor': 'Professor', 'responsavel': 'Responsável', 'pedagogico': 'Pedagógico e apoio'}
ordem = ['aluno', 'professor', 'responsavel', 'pedagogico']
linhas = [
    'SIESAL 4.0 - ACESSO TEMPORÁRIO PARA AUDITORIA EXTERNA (L16)',
    'Dados 100% fictícios. Contas exclusivas desta auditoria. Não há contas Master nem Admin.',
    '',
    f'Endereço (HTTPS): {url}',
    f'Disponível até: {fim} (o acesso é encerrado automaticamente)',
    'Instituição: já vem preenchida na tela de login (Instituição Demonstração).',
    '',
    'No primeiro acesso, cada conta pede para trocar a senha provisória. Escolha uma senha nova longa.',
    'Se errar a senha 5 vezes seguidas, a conta fica bloqueada por 15 minutos.',
    '',
]
for p in ordem:
    for e, v in contas.items():
        if v['perfil'] == p:
            linhas += [f"{rot[p]}: {e}", f"  senha provisória: {v['senha']}", '']
linhas += ['Não compartilhe este arquivo fora da equipe de auditoria. Não envie para repositórios.']
open(saida, 'w', encoding='utf-8').write('\n'.join(linhas))
print('arquivo montado:', saida)
