# Segurança da H&H IMPORTS

Atualização de 06/11/2026. Executar a migração `20261106194511_seguranca_ecommerce.sql` e `20261106200903_revogar_envios_estornados.sql` antes de publicar o código correspondente.

## Autenticação

- Senhas novas: frase exclusiva com pelo menos 15 caracteres e até 72 bytes; bcrypt custo 12. Contas antigas com senha curta entram em sessão restrita para atualização.
- Cada requisição privada valida identificação, versão de sessão, e-mail confirmado e bloqueio no banco. Troca de senha, papel, e-mail, bloqueio ou MFA revoga sessões anteriores.
- Clientes confirmam o e-mail no cadastro e entram com e-mail e senha, sem aplicativo autenticador ou aba de segurança administrativa. A troca comum de senha fica em Meus dados; senhas legadas fracas são atualizadas uma vez nesse formulário.
- Administradores precisam de TOTP. O campo de código aparece somente depois da validação da senha de uma conta administradora. Após entrar: Minha conta → Segurança do administrador → configurar autenticador → guardar os dez códigos de recuperação → entrar novamente com código. O reset de senha preserva o segundo fator.
- Códigos de confirmação são criptográficos, armazenados com HMAC, expiram em 15 minutos e permitem cinco erros. Recuperação usa token aleatório, hash SHA-256, uma hora de validade e consumo atômico.
- Proteção persistente de tentativas no Postgres; não depende da memória de uma função Vercel. Falha na proteção recusa a operação.

## Pagamentos e estoque

- Reembolsos, chargebacks, mediações e devoluções parciais persistem o estado financeiro e pausam a expedição. Créditos de fidelidade são revertidos proporcionalmente uma única vez; saldo negativo impede novo consumo até recomposição.
- Compra de etiqueta exige pagamento liberado no banco e consulta autenticada ao Mercado Pago imediatamente antes do checkout do Melhor Envio.
- Nenhuma integração externa permite uma transação atômica entre banco e duas operadoras. Estorno posterior à compra da etiqueta exige conferência/cancelamento pelo administrador; não devolvemos estoque de mercadoria já expedida automaticamente.
- Checkout com chave de idempotência por cliente/carrinho e máximo de três reservas pendentes por cliente. Preferência usa a mesma chave por pedido. Reservas novas sem preferência só expiram depois da janela de pagamento e consulta autenticada sem tentativas. Legados e boletos/Pix iniciados exigem conciliação.

## Fotos e abuso

- Catálogo no bucket público `joias`. Fotos de devolução no bucket privado `devolucoes`, servidas por API com autorização do dono ou administrador com MFA.
- Upload exige pedido entregue e item pertencente ao cliente. Três fotos por item e cota diária; imagem é decodificada, limitada em pixels e regravada em WebP sem metadados.
- Avaliação exige compra entregue e uma avaliação por comprador/produto. O identificador público é pseudônimo específico do produto, sem ID da conta.
- Cotação de frete tem limite persistente e cache de dois minutos. Etiquetas usam cotação nova.

## Publicação e variáveis

- Produção: `NEXTAUTH_SECRET` exclusivo, `MFA_ENCRYPTION_KEY` base64 de 32 bytes; não apagar/rotacionar a chave MFA sem migração das chaves cifradas.
- Credenciais reais de Supabase service-role, Mercado Pago, Melhor Envio e e-mail apenas em produção. Previews ficam em demonstração sem operações privadas; liberar apenas após fornecer recursos e credenciais de testes separados.
- A migração única das quatro fotos antigas foi concluída em produção, com referências atualizadas e originais públicos removidos. A rota temporária de manutenção foi removida após o uso; não faz parte da aplicação publicada.
- Headers de proteção e CSP com nonce por resposta HTML; sem scripts inline arbitrários em produção. Estilos inline permanecem permitidos para os componentes visuais existentes. HTML dinâmico preserva o nonce exclusivo; consultas do catálogo continuam cacheadas.

## Verificação

`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit`.
Não enviar senhas, tokens, fotos ou dados pessoais para logs. Testes usam provedores simulados e banco isolado; não compram etiquetas nem efetuam cobranças reais.
