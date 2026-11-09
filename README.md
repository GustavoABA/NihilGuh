# NihilGuh — Mundo Louco

Hub de live e interação da comunidade publicado em GitHub Pages, com estado autoritativo em Google Apps Script.

## Rotas

- `/` — perfil, canais, comunidade, apoio e estado da live.
- `/live/` — player Twitch, relógio, metas e rodada.
- `/tiktok/` — player Twitch isolado, 100% da janela, para captura no OBS/TikTok.
- `/tiktok/mobile/` — **redireciona diretamente** para `https://m.twitch.tv/nihilguh`, sem iframe ou player próprio.
- `/tiktok/mobile-direto/` — redireciona no nível principal para `https://m.twitch.tv/nihilguh` sem iframe; útil para testar a interface mobile real como Fonte de Navegador.
- `/play/` — minigame global sincronizado.
- `/overlay/` — overlay OBS 600×400.
- `/overlay.html` — URL legada do overlay.
- `/admin.html` — painel privado.
- `/starting/` — abertura musical/animação da live.

## Relógio

Cada sessão nasce com **240 min (4h)**.

Existe um único saldo de bônus autoritativo entre **0 e 240 min**, compartilhado por minigames, metas, LivePix e ajustes administrativos. O tempo total nunca passa de **480 min (8h)**.

A Escolha da Rainha pode retirar bônus já conquistado, mas nunca reduz a base de 4h.

## Minigames

Uma live recebe um baralho global de **23 rodadas**. O mesmo desafio é exibido para todos.

O potencial nominal positivo do baralho é **+240 min**:
- Reflexo do Gato ×3;
- Caça ao Coelho ×3;
- Ache o Diferente ×2;
- Digite Antes que Suma ×2;
- Palavra Embaralhada ×2;
- Sequência Maluca ×2;
- Conta da Rainha ×2;
- Memória de Cartas ×2;
- Código do Cheshire ×2;
- Labirinto do Abismo ×1;
- Puzzle Deslizante 4×4 ×1;
- Escolha da Rainha ×1.

Cada rodada permanece **ativa sem limite de tempo enquanto a Twitch estiver online**. Ela só termina quando alguém vence. Após a vitória, o backend aplica a alteração no relógio, mostra o resultado por alguns segundos e então cria a próxima rodada global.

O primeiro acerto válido fecha a rodada sob `LockService`. Labirinto e puzzle são reexecutados no backend para validar o caminho/movimentos.

Memória e Digite Antes que Suma usam ciclos globais repetidos de memorização → resposta. Enquanto ninguém vence, o ciclo recomeça para que quem entrar depois ainda tenha chance de participar; o conteúdo secreto deixa de ser enviado durante a fase de resposta.

## Estado e escala

- Google Sheets: histórico persistente de lives, metas, visitantes e eventos.
- ScriptProperties: somente o estado global compacto da rodada.
- CacheService: presença/tentativas por jogador, configuração e leituras quentes.
- `stateLite`: endpoint usado pelo polling público.
- uma única requisição de polling por navegador fica em voo por vez.

O identificador do jogador continua sendo casual, baseado no navegador. Não é autenticação forte e não deve ser usado para prêmios de valor real.

## Motor legado

O antigo motor automático de Boss/Caos/Votos/Missões permanece no código apenas para referência histórica, mas está **desativado**. Ele não altera mais o relógio nem cria mecânicas invisíveis.

## Segurança

- ações administrativas mutáveis usam POST;
- ações administrativas por GET foram removidas;
- `ADMIN_KEY` e `BRIDGE_KEY` não são mais impressas nos logs de `setup()`;
- respostas corretas continuam somente no backend.

## Backend

Fontes:
- `apps-script/Code.gs`
- `apps-script/Interactions.gs`
- `apps-script/RoundEngine.gs`

Para publicar, use `apps-script/ALL_IN_ONE.gs`. O CI verifica que ele é exatamente a concatenação das três fontes acima.

## Deploy

O GitHub Pages publica automaticamente o branch `main`.

O Apps Script precisa ser atualizado separadamente por **Gerenciar implantações → Editar → Nova versão**, preservando a mesma URL `/exec`.

## Home durante a live

Quando a Twitch está online, a home prioriza a transmissão: o player aparece primeiro e o minigame global fica imediatamente abaixo do vídeo, permitindo assistir e jogar na mesma página.

O embed usa autoplay com áudio inicialmente mutado para maximizar compatibilidade com as políticas de reprodução automática dos navegadores. Em dispositivos móveis, a Twitch pode exigir interação do usuário para iniciar o vídeo.


## Overlay OBS

O overlay 600×400 é transparente e usa um ciclo sincronizado pela hora de início da live:

1. **5 minutos:** somente o cronômetro.
2. **3 minutos:** CTA animado com o avatar apontando para o site `gustavoaba.github.io/NihilGuh-Site-Vibecode/`.
3. **20 minutos:** somente o cronômetro.
4. **20 segundos:** resumo animado dos vencedores daquele ciclo, mostrando jogador, jogo e minutos aplicados.
5. O ciclo recomeça.

O backend mantém um feed compacto com até 23 vencedores da sessão. O overlay não consulta a planilha inteira a cada atualização.

## Tela de início

A rota `/starting/` é uma composição 16:9 em preto e branco sincronizada pelo `currentTime` de `assets/audio/harpy-hare.mp3`. O repositório não inclui a gravação comercial; coloque no caminho indicado uma cópia que você tenha direito de usar na transmissão.

- `/starting/?preview=1` testa as cenas sem áudio.
- `/starting/?debug=1` habilita seek e ajuste fino de offset para calibrar o master usado na live.
- ao fim da faixa, a tela faz fade, aguarda 2 minutos e reinicia.


### Motor visual da tela de início

A abertura usa uma timeline determinística baseada na **Web Animations API**. As animações são criadas pausadas e o `currentTime` de cada uma é sincronizado ao relógio mestre da música/preview, evitando que loops CSS independentes saiam de fase.

Os movimentos principais usam `transform` e `opacity`; `requestAnimationFrame` atua apenas como controlador de sincronização.

O vídeo enviado como referência foi convertido para uma textura de baixíssimo peso e está em:

`assets/video/harpy-hare-reference.mp4`

Essa cópia é deliberadamente pequena porque aparece somente como textura desfocada/monocromática no palco. O vídeo original continua sendo a referência visual de direção de arte.

## Player TikTok (rota independente)

Abra `/tiktok/` em uma fonte de navegador do OBS (p. ex., 1080×1920 para fonte vertical ou 1920×1080 para horizontal).
A página usa o **player oficial Twitch** para o canal `nihilguh`, sem chat e sem a interface do site.
A URL tenta autoplay **com som**. Quando a política do navegador bloquear isso, ela
tenta reproduzir mutada e mostra o botão **Ativar som / iniciar live**.

- `/tiktok/?muted=1`: inicia mutado para maximizar a compatibilidade de autoplay.
- `/tiktok/?clean=1`: oculta o botão de recuperação (use apenas se reprodução/áudio já estiverem autorizados).
- Tecla **F**: solicita tela cheia nativa após a interação do usuário; no OBS o CSS já preenche 100% da fonte.

**Limitações:** browsers móveis podem exigir toque para iniciar o vídeo; navegadores normalmente
bloqueiam autoplay com som. Nenhum JavaScript pode obrigar tela cheia nativa sem
interação do usuário. Se capturar áudio no OBS, é preciso configurar a fonte de áudio
corretamente; câmera virtual transmite vídeo, não necessariamente áudio. O player
da Twitch impõe tamanho mínimo de 400×300 px, portanto algumas telas móveis
muito estreitas terão um pequeno corte horizontal.

### Twitch mobile real na rota principal

A rota `/tiktok/mobile/` redireciona de imediato o navegador para
`https://m.twitch.tv/nihilguh`. Não usa iframe e não cria o embed
`embed.twitch.tv`. É o mesmo endereço usado no primeiro print do usuário.

Para capturar no OBS ou TikTok Live Studio, configure a fonte com dimensão
**1080×1920** e abra `/tiktok/mobile/`, ou abra diretamente
`https://m.twitch.tv/nihilguh`. A interface mostrada na captura será
determinada pela Twitch e pelo navegador. O redirecionamento não altera o
formato original do vídeo e, após a navegação para Twitch, nosso JavaScript
não consegue controlar autoplay/áudio ou obrigar a interface mobile.

A rota `/tiktok/` continua disponível como alternativa com player
incorporado oficial, caso a Twitch não exiba o layout desejado no OBS.

### Abrir Twitch mobile real sem iframe

A nova rota `/tiktok/mobile-direto/` faz uma navegação de primeiro nível para
`https://m.twitch.tv/nihilguh`. Esta é uma experiência diferente do embed
oficial `/tiktok/mobile/`. O redirecionamento evita a restrição de incorporar
uma página comum da Twitch dentro de um iframe. Para testar, use a nova rota
como URL de Fonte de Navegador do OBS, configure 1080×1920 e recarregue a fonte.

Limitações: a Twitch pode usar a identificação do navegador para decidir qual
interface exibir; não há garantia de permanecer no layout móvel num browser
de desktop. Depois do redirecionamento, nosso site não tem controle sobre o
play/áudio, e a Twitch pode exigir interação para reprodução automática.
O layout da interface não altera o formato original do vídeo transmitido.
