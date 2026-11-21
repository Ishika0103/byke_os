import { router } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { ChangePasswordForm } from '@/features/auth';

export default function ChangePasswordScreen() {
  return (
    <ChangePasswordForm
      header={<PageHeader back title="Change password" subtitle="For your own account" />}
      onDone={() => router.back()}
    />
  );
}
