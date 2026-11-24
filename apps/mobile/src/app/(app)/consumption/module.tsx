import { useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { ModuleCalendar, useConsumptionModules } from '@/features/consumption';

export default function ConsumptionModuleScreen() {
  const { module } = useLocalSearchParams<{ module: string }>();
  const { modules } = useConsumptionModules();
  const name = modules.find((m) => m.code === module)?.name ?? module;
  return (
    <ModuleCalendar
      module={module}
      header={<PageHeader back title={name} subtitle="Consumption marked per day" />}
    />
  );
}
