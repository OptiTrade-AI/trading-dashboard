import { redirect } from 'next/navigation';

export default function CspScreenerRedirect() {
  redirect('/screeners?tab=csp');
}
