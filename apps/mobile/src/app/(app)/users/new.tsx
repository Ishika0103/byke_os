import { router } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { UserForm } from '@/features/users';

export default function NewUserScreen() {
  return (
    <UserForm
      header={<PageHeader back title="Add user" subtitle="They sign in with this email" />}
      onSaved={() => router.back()}
    />
  );
}
