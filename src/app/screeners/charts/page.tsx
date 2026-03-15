import { redirect } from 'next/navigation';

export default function ChartsScreenerRedirect() {
  redirect('/screeners?tab=charts');
}
