/**
 * Root /  — the middleware rewrites all requests to /[locale]/...
 * This page should never render in normal flow, but serves as a fallback.
 */
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/ja');
}
