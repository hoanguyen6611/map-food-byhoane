import { redirect } from 'next/navigation';
import { loginHref } from './login-href';

/** Server pages: send signed-out visitors to login with a notice, and back here afterwards. */
export function redirectToLogin(next: string): never {
  redirect(loginHref(next, 'required'));
}
