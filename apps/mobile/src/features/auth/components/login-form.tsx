import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { loginSchema } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField, type TextInputHandle } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '../hooks/use-auth';

type FieldErrors = { email?: string; password?: string };

/** Maps API errors to messages a hotel user understands. */
function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'UNAUTHENTICATED':
        return 'Invalid email or password.';
      case 'ACCOUNT_DISABLED':
        return 'Your account is disabled. Please contact your administrator.';
      case 'TOO_MANY_REQUESTS':
        return 'Too many attempts. Please wait a few minutes and try again.';
      default:
        return error.message;
    }
  }
  return 'Cannot reach the server. Check your connection and try again.';
}

export function LoginForm() {
  const theme = useTheme();
  const { login } = useAuth();
  const passwordRef = useRef<TextInputHandle>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    // Same Zod schema the API uses, for instant feedback.
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        errors[field] ??= field === 'email' ? 'Enter a valid email' : issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      await login(parsed.data);
      // On success the root layout's guard switches to the app automatically.
    } catch (error) {
      setFormError(messageFor(error));
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      {formError ? (
        <View
          accessibilityRole="alert"
          style={[styles.banner, { backgroundColor: theme.errorBackground }]}
        >
          <ThemedText type="small" themeColor="error">
            {formError}
          </ThemedText>
        </View>
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        placeholder="you@thebyke.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!submitting}
      />

      <View>
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={!submitting}
          style={styles.passwordInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          onPress={() => setShowPassword((v) => !v)}
          style={styles.toggle}
          hitSlop={8}
        >
          <ThemedText type="link">{showPassword ? 'Hide' : 'Show'}</ThemedText>
        </Pressable>
      </View>

      <Button title="Sign in" onPress={onSubmit} loading={submitting} style={styles.submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  banner: { borderRadius: Radius.sm, padding: Spacing.three },
  passwordInput: { paddingRight: 64 },
  toggle: { position: 'absolute', right: Spacing.three, top: 34 },
  submit: { marginTop: Spacing.two },
});
