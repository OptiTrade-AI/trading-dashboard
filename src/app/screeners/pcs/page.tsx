import { redirect } from 'next/navigation';

export default function PcsScreenerRedirect() {
  redirect('/screeners?tab=pcs');
}
