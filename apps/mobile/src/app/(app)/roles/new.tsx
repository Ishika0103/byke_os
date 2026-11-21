import { router } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { RoleForm } from '@/features/roles';

export default function NewRoleScreen() {
  return (
    <RoleForm
      header={<PageHeader back title="Add role" subtitle="A job role you can give to users" />}
      onSaved={() => router.back()}
    />
  );
}
