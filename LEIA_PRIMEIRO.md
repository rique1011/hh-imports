# Leia primeiro — H&H IMPORTS

Repositório do projeto: https://github.com/henrique101101/H-H-IMPORTS, branch `main`.

O código inclui as correções de marca, checkout, webhook do Mercado Pago, notificações para cliente e administrador e recuperação diária de e-mails pela fila de notificações.

## Arquivos do projeto

O pacote corrigido contém 98 arquivos de código, recursos, configuração, documentação e testes. A comparação com o RAR antigo confirmou que o código original está contemplado. Arquivos de `node_modules` e `.next` são recriados na instalação e no build. O histórico Git antigo não faz parte deste pacote. O Next.js também gera `next-env.d.ts` automaticamente.

Para uma cópia manual, extraia o pacote e coloque `package.json`, `app`, `components`, `lib`, `public`, `docs`, `supabase` e `tests` na raiz do repositório. Enviar somente o ZIP não permite executar o projeto.

## Executar e publicar

1. Execute `npm ci` para instalar as dependências do `package-lock.json`.
2. Configure as variáveis descritas em `.env.example` no ambiente correspondente. Esse arquivo contém apenas referências; valores secretos devem ser mantidos fora do Git.
3. Execute `npm test` e `npm run build` para conferir testes e compilação. Para desenvolvimento, use `npm run dev`.
4. Conecte o projeto Vercel existente `anhel-imports` a este repositório e à branch `main`, conservando domínio e variáveis já cadastrados.
5. Continue usando o mesmo Supabase. A migração de notificações já foi aplicada; não a reaplique somente por mudar de repositório.
6. Após o deploy, valide um pagamento de homologação e os e-mails de cliente e administrador.

Consulte `docs/IMPLEMENTACAO_HH_IMPORTS.md` para os detalhes técnicos e `docs/STATUS_IMPLANTACAO.md` para o estado da publicação.
