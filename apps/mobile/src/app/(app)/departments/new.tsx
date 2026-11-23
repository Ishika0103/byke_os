import { router } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { DepartmentForm } from '@/features/departments';

export default function NewDepartmentScreen() {
  return (
    <DepartmentForm
      header={
        <PageHeader back title="Add department" subtitle="A team users and tasks belong to" />
      }
      onSaved={() => router.back()}
    />
  );
}
