# Verificação externa do SIESAL pela URL HTTPS do túnel. Fora do projeto. Nunca imprime senha, token ou corpo de resposta.
import http.client, json, ssl, sys, time, urllib.parse

BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
INST_B = sys.argv[3]
HOST = urllib.parse.urlparse(BASE).hostname
ctx = ssl.create_default_context()
resultados = []
logins = []


def req(metodo, caminho, corpo=None, cookie=None, extra=None, host=HOST, https=True):
    h = {'accept': 'application/json'}
    if corpo is not None:
        h['content-type'] = 'application/json'
    if cookie:
        h['cookie'] = cookie
    h.update(extra or {})
    c = http.client.HTTPSConnection(host, timeout=30, context=ctx) if https else http.client.HTTPConnection(host, timeout=30)
    c.request(metodo, caminho, body=json.dumps(corpo) if corpo is not None else None, headers=h)
    r = c.getresponse()
    dados = r.read()
    try:
        j = json.loads(dados) if dados else None
    except Exception:
        j = None
    cab = {k.lower(): v for k, v in r.getheaders()}
    setc = [v for k, v in r.getheaders() if k.lower() == 'set-cookie']
    c.close()
    return r.status, cab, j, setc


def ok(nome, cond, detalhe=''):
    resultados.append((nome, bool(cond), detalhe))
    print(('PASS ' if cond else 'FAIL ') + nome + (f' [{detalhe}]' if detalhe and not cond else ''), flush=True)


def esperar_limite():
    # O limite é de 10 tentativas por minuto, compartilhado atrás do túnel: fica abaixo de 8
    agora = time.time()
    while len([t for t in logins if agora - t < 62]) >= 8:
        time.sleep(3)
        agora = time.time()
    logins.append(time.time())


def entrar(email, senha, inst):
    esperar_limite()
    st, cab, j, setc = req('POST', '/api/auth/login', {'instituicao_id': inst, 'email': email, 'senha': senha})
    cookie = setc[0].split(';')[0] if setc else None
    return st, j, cookie, setc


def carregar(arq):
    return json.load(open(f'{OUT}/{arq}', encoding='utf-8'))


demo = carregar('ver-demo.json')
vb = carregar('ver-b.json')
aud = carregar('auditoria.json')
por_perfil = lambda d, p, suf='': next(e for e, v in d.items() if v['perfil'] == p and (suf in e))

st, cab, cfg, _ = req('GET', '/api/config')
INST = cfg['instituicao_padrao']
ok('config: modo local desligado (cookie seguro)', st == 200 and cfg.get('modo_local') is False)

# --- Cabeçalhos da página ---
st, cab, _, _ = req('GET', '/')
ok('página inicial 200 por HTTPS', st == 200)
ok('cabeçalho X-Content-Type-Options: nosniff', cab.get('x-content-type-options') == 'nosniff')
ok('cabeçalho X-Frame-Options: DENY', cab.get('x-frame-options') == 'DENY')
ok('cabeçalho Referrer-Policy: no-referrer', cab.get('referrer-policy') == 'no-referrer')
ok("cabeçalho CSP com default-src 'self' e frame-ancestors 'none'", "default-src 'self'" in cab.get('content-security-policy', '') and "frame-ancestors 'none'" in cab.get('content-security-policy', ''))
ok('cabeçalho Permissions-Policy bloqueia câmera, microfone e localização', 'camera=()' in cab.get('permissions-policy', ''))
ok('sem versão do servidor exposta (Server)', not any(ch.isdigit() for ch in cab.get('server', '')), cab.get('server', ''))
st, cab, _, _ = req('GET', '/', https=False)
ok('HTTP simples não serve a página (redireciona para HTTPS ou recusa)', st in (301, 302, 307, 308) and cab.get('location', '').startswith('https://') or st >= 400, f'status {st}')
for caminho in ['/metrics', '/api/metrics', '/.env', '/api/../.env', '/admin', '/api/admin', '/server-status']:
    st, _, _, _ = req('GET', caminho)
    ok(f'caminho sensível {caminho} não entrega conteúdo de serviço', st in (200, 400, 401, 403, 404) and st != 500)

# --- Sessão: login, cookie, /eu, logout ---
ea1, ea2 = por_perfil(demo, 'aluno', 'aluno1'), por_perfil(demo, 'aluno', 'aluno2')
st, j, cookie, setc = entrar(ea1, demo[ea1]['senha'], INST)
ok('login do aluno (verificação) retorna 200', st == 200 and j and j.get('nivel') == 'completo')
attrs = setc[0] if setc else ''
ok('cookie com prefixo __Host-', attrs.startswith('__Host-siesal_sessao='))
ok('cookie com Secure', '; Secure' in attrs)
ok('cookie com HttpOnly', 'HttpOnly' in attrs)
ok('cookie com SameSite=Strict', 'SameSite=Strict' in attrs)
ok('cookie com Path=/ e sem Domain', 'Path=/' in attrs and 'Domain' not in attrs)
ok('corpo do login não devolve o token', 'token' not in json.dumps(j or {}).lower())
st, _, eu, _ = req('GET', '/api/auth/eu', cookie=cookie)
ok('/auth/eu com sessão devolve o perfil aluno', st == 200 and eu['usuario']['perfil'] == 'aluno')
st, _, _, _ = req('GET', '/api/auth/eu')
ok('/auth/eu sem cookie: 401', st == 401)
st, _, _, _ = req('GET', '/api/auth/eu', cookie=cookie.replace('__Host-', ''))
ok('cookie sem o prefixo __Host- não é aceito', st == 401)
st, _, _, _ = req('GET', '/api/auth/eu', cookie='__Host-siesal_sessao=' + 'a' * 60)
ok('token inventado: 401', st == 401)
st, _, _, setc2 = req('POST', '/api/auth/logout', cookie=cookie)
ok('logout: 204 e cookie apagado', st == 204 and any('Max-Age=0' in s for s in setc2))
st, _, _, _ = req('GET', '/api/auth/eu', cookie=cookie)
ok('depois do logout o mesmo token deixa de valer (401)', st == 401)

# --- Rotas protegidas sem sessão ---
for m, c in [('GET', '/api/notas-oficiais'), ('GET', '/api/caixa'), ('POST', '/api/caixa/vistos'), ('GET', '/api/pedidos-revisao'),
             ('GET', '/api/usuarios'), ('GET', '/api/avisos-escolares'), ('POST', '/api/avisos-escolares'), ('GET', '/api/meu-dia'), ('GET', '/api/tarefas')]:
    st, _, _, _ = req(m, c, {} if m == 'POST' else None)
    ok(f'sem sessão {m} {c}: 401', st == 401, f'status {st}')

# --- Sessões por perfil (instituição demo) ---
sess = {}
for nome, e in [('aluno1', ea1), ('aluno2', ea2), ('resp', por_perfil(demo, 'responsavel')), ('prof', por_perfil(demo, 'professor')), ('ped', por_perfil(demo, 'pedagogico'))]:
    st, j, ck, _ = entrar(e, demo[e]['senha'], INST)
    ok(f'login verificação {nome}', st == 200, f'status {st}')
    sess[nome] = ck
turma_id = None
st, _, tj, _ = req('GET', '/api/avisos-escolares/turmas', cookie=sess['ped'])
ok('Pedagógico lista as turmas da própria instituição', st == 200 and len(tj['turmas']) >= 1)

# --- Permissões por perfil (deny by default) ---
def nega(quem, m, c, corpo=None, esperado=(403,)):
    st, _, _, _ = req(m, c, corpo, cookie=sess[quem])
    ok(f'{quem} {m} {c}: negado', st in esperado, f'status {st}')

for q in ['aluno1', 'resp', 'prof']:
    nega(q, 'GET', '/api/usuarios')
    nega(q, 'POST', '/api/avisos-escolares', {'texto': 'x', 'turma_id': tj['turmas'][0]['id']})
    nega(q, 'GET', '/api/avisos-escolares')
for q in ['aluno1', 'resp', 'ped']:
    nega(q, 'POST', '/api/notas-oficiais', {'aluno_id': '00000000-0000-4000-8000-000000000000', 'turma_id': '00000000-0000-4000-8000-000000000000', 'disciplina_id': '00000000-0000-4000-8000-000000000000', 'valor': 10, 'dia': '2026-11-05'})
nega('ped', 'GET', '/api/usuarios')
nega('aluno1', 'POST', '/api/notas-oficiais/00000000-0000-4000-8000-000000000000/revisoes', {'valor': 10, 'motivo': 'x'})

# --- Isolamento entre usuários (mesma instituição) ---
def notas(quem):
    return req('GET', '/api/notas-oficiais', cookie=sess[quem])[2]['notas']

n1, n2, nr, np_, npd = notas('aluno1'), notas('aluno2'), notas('resp'), notas('prof'), notas('ped')
ok('aluno 1 vê só a própria nota (1)', len(n1) == 1 and n1[0]['valor'] == 7.5)
ok('aluno 2 vê só a própria nota (1) e não a do aluno 1', len(n2) == 1 and n2[0]['valor'] == 6.0 and n2[0]['id'] != n1[0]['id'])
ok('responsável vê só a nota do aluno vinculado', [n['id'] for n in nr] == [n1[0]['id']])
ok('professor vê as 2 notas da própria turma e nada de fora', len(np_) == 2 and {n['id'] for n in np_} == {n1[0]['id'], n2[0]['id']})
ok('Pedagógico lê a nota atual sem histórico', len(npd) >= 2 and all('versoes' not in n for n in npd))
ok('aluno e responsável não recebem histórico', all('versoes' not in n for n in n1 + n2 + nr))
t1 = req('GET', '/api/tarefas', cookie=sess['aluno1'])[2]['tarefas']
t2 = req('GET', '/api/tarefas', cookie=sess['aluno2'])[2]['tarefas']
ok('tarefas: cada aluno vê só as próprias', len(t1) == 3 and len(t2) == 1 and not ({t['id'] for t in t1} & {t['id'] for t in t2}))
st, _, _, _ = req('GET', '/api/tarefas', cookie=sess['resp'])
ok('responsável não acessa as tarefas do aluno pela rota do aluno', st in (403, 404), f'status {st}')

# --- Isolamento entre instituições ---
eb = {p: por_perfil(vb, p) for p in ['aluno', 'professor', 'pedagogico', 'responsavel']}
st, _, _, _ = entrar(eb['aluno'], vb[eb['aluno']]['senha'], INST)
ok('conta da Escola B não entra pela instituição Demonstração', st == 401, f'status {st}')
bs = {}
for p, e in eb.items():
    st, _, ck, _ = entrar(e, vb[e]['senha'], INST_B)
    ok(f'login Escola B {p}', st == 200, f'status {st}')
    bs[p] = ck
ids_demo = {n['id'] for n in npd}
def b_notas(p):
    return req('GET', '/api/notas-oficiais', cookie=bs[p])[2]['notas']
for p in ['aluno', 'professor', 'pedagogico', 'responsavel']:
    ids_b = {n['id'] for n in b_notas(p)}
    ok(f'Escola B ({p}) não vê nenhuma nota da Demonstração', not (ids_b & ids_demo))
ok('Escola B (professor) vê só as 2 notas da própria turma', len(b_notas('professor')) == 2)
ok('Escola B (pedagógico) vê só as notas da própria escola', len(b_notas('pedagogico')) == 2)
# aviso e caixa não cruzam instituições
cx = req('GET', '/api/caixa', cookie=bs['aluno'])[2]
ok('Escola B (aluno) não recebe o aviso da turma da Demonstração', not any('Bem-vindos' in json.dumps(i) for i in cx['itens']))
st, _, _, _ = req('POST', '/api/avisos-escolares', {'texto': 'Aviso indevido', 'turma_id': tj['turmas'][0]['id']}, cookie=bs['pedagogico'])
ok('Pedagógico da Escola B não publica em turma da Demonstração (404)', st == 404, f'status {st}')
st, _, _, _ = req('POST', f'/api/notas-oficiais/{n1[0]["id"]}/revisoes', {'valor': 1, 'motivo': 'x'}, cookie=bs['professor'])
ok('professor da Escola B não revisa nota da Demonstração (404)', st == 404, f'status {st}')
st, _, _, _ = req('POST', f'/api/notas-oficiais/{n1[0]["id"]}/pedidos', {'texto': 'oi'}, cookie=bs['aluno'])
ok('aluno da Escola B não pede revisão de nota da Demonstração (404)', st == 404, f'status {st}')

# --- Fluxo do L16 (caixa, fechar juntos, A-027) ---
cx = req('GET', '/api/caixa', cookie=sess['prof'])[2]
ok('professor vê 2 pedidos abertos na caixa, ambos não vistos', len(cx['itens']) == 2 and cx['nao_vistos'] == 2)
cp = req('GET', '/api/caixa', cookie=sess['ped'])[2]
ok('Pedagógico não tem pedidos de outros na caixa nem avisos', cp['itens'] == [])
ca = req('GET', '/api/caixa', cookie=sess['aluno1'])[2]
ok('aluno 1 recebe o aviso da turma', any(i['tipo'] == 'aviso' for i in ca['itens']))
ok('aluno 2 recebe o mesmo aviso (mesma turma) mas não vê itens do aluno 1', all(i['tipo'] == 'aviso' for i in req('GET', '/api/caixa', cookie=sess['aluno2'])[2]['itens']))
st, _, mv, _ = req('POST', '/api/caixa/vistos', cookie=sess['prof'])
ok('abrir a caixa marca como visto', st in (200, 201) and mv['marcados'] == 2)
SEGREDO = 'MOTIVO-SECRETO-VERIFICACAO'
st, _, rv, _ = req('POST', f'/api/notas-oficiais/{n1[0]["id"]}/revisoes', {'valor': 8.0, 'motivo': SEGREDO}, cookie=sess['prof'])
ok('revisar fecha juntos os 2 pedidos da nota', st == 201 and rv['pedidos_fechados'] == 2, f'status {st}')
for q in ['aluno1', 'resp']:
    cj = req('GET', '/api/caixa', cookie=sess[q])[2]
    resp = [i for i in cj['itens'] if i['tipo'] == 'resposta']
    ok(f'{q} recebe a resposta "revisada" com a nota atual 8,0', len(resp) == 1 and resp[0]['estado'] == 'revisada' and resp[0]['valor_atual'] == 8.0)
    ok(f'{q} não recebe o motivo da revisão', SEGREDO not in json.dumps(cj))
for q in ['aluno1', 'aluno2', 'resp', 'ped']:
    corpo = ''.join(json.dumps(req('GET', r, cookie=sess[q])[2]) for r in ['/api/caixa', '/api/pedidos-revisao', '/api/notas-oficiais'])
    ok(f'{q}: o motivo da revisão e as versões antigas não aparecem em nenhuma rota', SEGREDO not in corpo and 'versoes' not in corpo)
hp = [n for n in req('GET', '/api/notas-oficiais', cookie=sess['prof'])[2]['notas'] if n['id'] == n1[0]['id']][0]
ok('professor continua vendo o histórico e o motivo', SEGREDO in json.dumps(hp.get('versoes')))
st, _, pr, _ = req('GET', '/api/pedidos-revisao', cookie=sess['aluno1'])
ok('aluno 1 não recebe número de versão no pedido', all(p.get('versao_atual') is None for p in pr['pedidos']))

# --- Contas de auditoria: só o primeiro login (senha provisória), sem alterar a senha ---
for e, v in aud.items():
    st, j, ck, setc = entrar(e, v['senha'], INST)
    ok(f'conta de auditoria {v["perfil"]}: login 200 e senha provisória exige troca', st == 200 and j.get('nivel') == 'trocar_senha' and setc and setc[0].startswith('__Host-'), f'status {st}')
    if ck:
        req('POST', '/api/auth/logout', cookie=ck)

# --- Cabeçalhos do cliente não são confiáveis (por último: consome o limite de login) ---
time.sleep(65)
bloqueios = 0
for i in range(13):
    st, _, _, _ = req('POST', '/api/auth/login', {'instituicao_id': INST, 'email': f'inexistente{i}@exemplo.invalid', 'senha': 'x'}, extra={'x-forwarded-for': f'203.0.113.{i + 1}', 'x-real-ip': f'198.51.100.{i + 1}', 'cf-connecting-ip': f'192.0.2.{i + 1}'})
    if st == 429:
        bloqueios += 1
ok('limite de tentativas ignora X-Forwarded-For, X-Real-IP e CF-Connecting-IP enviados pelo cliente (429 apesar de IPs diferentes)', bloqueios >= 1, f'{bloqueios} respostas 429')
st, cab, _, setc = req('POST', '/api/auth/login', {'instituicao_id': INST, 'email': 'x@exemplo.invalid', 'senha': 'x'}, extra={'x-forwarded-proto': 'http', 'host': HOST})
ok('X-Forwarded-Proto enviado pelo cliente não enfraquece o cookie (sem cookie em falha)', not setc)

falhas = [r for r in resultados if not r[1]]
json.dump({'total': len(resultados), 'falhas': [r[0] for r in falhas]}, open(f'{OUT}/resultado.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'TOTAL {len(resultados)}  APROVADAS {len(resultados) - len(falhas)}  FALHAS {len(falhas)}')
