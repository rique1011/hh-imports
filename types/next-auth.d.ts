import type { DefaultSession } from 'next-auth'
declare module 'next-auth' {
 interface Session { user: DefaultSession['user'] & {role?:string;mfa?:boolean;senhaAtual?:boolean} }
 interface User {role?:string;sessaoVersao?:number;mfa?:boolean;senhaAtual?:boolean}
}
declare module 'next-auth/jwt' {interface JWT {role?:string;sessaoVersao?:number;mfa?:boolean;senhaAtual?:boolean}}
