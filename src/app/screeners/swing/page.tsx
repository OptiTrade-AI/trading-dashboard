import { redirect } from 'next/navigation';

export default function SwingScreenerRedirect() {
  redirect('/screeners?tab=swing');
}
