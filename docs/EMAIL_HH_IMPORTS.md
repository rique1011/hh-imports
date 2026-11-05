# Contato oficial e envio de e-mails

Contato oficial: **hehimports.contato@gmail.com**.

As páginas de contato, rodapé, privacidade e trocas usam `CONTACT_EMAIL`, definido em `lib/brand.ts`. A variável pública `NEXT_PUBLIC_CONTACT_EMAIL` substitui o padrão. Os links usam `mailto:` e o formulário de contato envia para o destino fixo no servidor, com confirmação somente após o SMTP aceitar a mensagem.

`ADMIN_EMAIL` é o destinatário dos avisos de novos pedidos e pagamentos. Seu padrão é o contato da loja. `Reply-To` dos e-mails aos clientes também usa o contato oficial. No formulário de contato, a mensagem chega à loja e o `Reply-To` é o endereço validado do visitante. Nome e mensagem são escapados para HTML.

O remetente das novas etiquetas Melhor Envio e o contato técnico das requisições usam o contato público da loja, preservando CPF, nome civil, telefone e endereço configurados. Etiquetas anteriores mantêm seu snapshot.

## Gmail: último passo de autenticação

Mudar o endereço de recebimento não autoriza o envio pela conta nova. As credenciais SMTP são um par: usuário e senha de app daquela mesma conta.

1. Entre na conta Google **hehimports.contato@gmail.com** e ative a verificação em duas etapas.
2. Abra [Senhas de app](https://myaccount.google.com/apppasswords), crie uma para H&H IMPORTS e copie o valor apresentado.
3. Na Vercel, projeto hh-imports → Settings → Environment Variables, edite o par de produção:

   ```dotenv
   EMAIL_USER=hehimports.contato@gmail.com
   EMAIL_PASS=SENHA_DE_APP_GERADA_NESSA_CONTA
   ```

4. Faça um redeploy para aplicar as credenciais.

Cadastre a senha diretamente na Vercel como Secret. Não coloque senhas no código ou em mensagens. Os remetentes usam o usuário realmente autenticado no Gmail; não usam um From diferente da conta SMTP. Até o novo par ser configurado, o envio conserva a autenticação anterior, enquanto contato público, destinatário administrativo e respostas apontam para a nova caixa.

Cadastro, pedidos, recuperação de senha e rotinas existentes de recuperação de carrinho compartilham o mesmo envio SMTP. As rotinas de carrinho deixaram de usar remetentes de exemplo do Resend; não foi criado um novo agendamento de marketing.

O contato valida origem, formato e tamanho, limita tentativas por instância e possui honeypot. A contenção é local à instância, não um limite global distribuído. Não armazena mensagens novas em tabelas públicas e não permite ao visitante escolher o destinatário.

Referências: [Senhas de app do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR) e [Gmail no Nodemailer](https://nodemailer.com/guides/using-gmail).
