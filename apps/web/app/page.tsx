import { redirect } from 'next/navigation';

// Root redirect — will go to dashboard if authed, login if not
export default function RootPage() {
  redirect('/dashboard');
}
