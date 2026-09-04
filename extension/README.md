# ScaleTask — Extensão de Captura (Biblioteca de Anúncios do Meta)

Injeta um botão em cada anúncio da **Biblioteca de Anúncios do Meta** para salvar a oferta no seu workspace do ScaleTask, com a data de início do anúncio detectada automaticamente.

## Instalar (modo desenvolvedor)

1. Baixe e descompacte a pasta `extension`.
2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `extension`.
5. Clique no ícone da extensão na barra e **faça login** com sua conta do ScaleTask.

## Usar

1. Acesse `https://www.facebook.com/ads/library/`.
2. Em cada anúncio aparece o botão **★ ScaleTask**.
3. Clique nele → selecione o **workspace**, informe **oferta** e **expert**.
4. A data de início (“Veiculação iniciada em…”) e os dias rodando são preenchidos automaticamente.
5. **Salvar** grava no workspace escolhido.

## Observações

- Funciona **apenas** na Biblioteca de Anúncios do Meta.
- Os dados ficam protegidos por RLS no Supabase: você só grava em workspaces dos quais participa.
- O layout da Biblioteca muda com frequência; se o botão parar de aparecer ou a data não for detectada, é só ajustar os seletores em `content.js`.
