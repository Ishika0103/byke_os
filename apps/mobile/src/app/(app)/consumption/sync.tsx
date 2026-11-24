import { PageHeader } from '@/components/ui/page-header';
import { SyncPanel } from '@/features/consumption';

export default function ConsumptionSyncScreen() {
  return (
    <SyncPanel
      header={<PageHeader back title="Sync consumption" subtitle="Read the Google Sheet" />}
    />
  );
}
