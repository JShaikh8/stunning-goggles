import { getAvailableSlateDates, getDfsPool } from '@/lib/db/queries';
import { LineupsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function LineupsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const availableDates = await getAvailableSlateDates();
  const date = params.date ?? availableDates[0] ?? new Date().toISOString().slice(0, 10);
  const pool = date ? await getDfsPool(date) : [];

  return (
    <LineupsClient
      initialDate={date}
      availableDates={availableDates}
      initialPool={pool}
    />
  );
}
