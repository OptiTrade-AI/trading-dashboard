import { redirect } from 'next/navigation';

export default function AggressiveScreenerRedirect() {
  redirect('/screeners?tab=aggressive');
}
