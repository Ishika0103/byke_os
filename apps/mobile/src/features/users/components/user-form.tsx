import { usePermission } from '@/features/auth';
import { ReadOnly } from '@/components/ui/read-only';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  createUserSchema,
  SUPER_ADMIN_ROLE_CODE,
  updateUserSchema,
  type User,
} from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { MultiSelectField } from '@/components/ui/multi-select-field';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useDepartmentOptions } from '@/features/departments';
import { useHotelOptions } from '@/features/hotels';
import { useRoleOptions } from '@/features/roles';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { usersApi } from '../api/users.api';

const CODE_FIELDS = { EMAIL_TAKEN: 'email' };

/**
 * Add user (no `user`) or edit user, as a full screen with Save pinned at the bottom.
 * Passwords are set only when creating; existing users get a new one via "Reset password".
 * You can't change your own role. Everyone except Super Admin works at one or more hotels (Plan 05). Status is changed with its own toggle (edit screen).
 * `children` = extra sections (edit screen actions).
 */
export function UserForm({
  user,
  isSelf = false,
  header,
  onSaved,
  children,
}: {
  user?: User;
  isSelf?: boolean;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!user;
  // Without the edit permission an existing record is shown read-only (Plan 06).
  const canEdit = usePermission('edit-user');
  const locked = editing && !canEdit;
  const { roles, error: rolesError } = useRoleOptions();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const { hotels, error: hotelsError } = useHotelOptions();
  const { departments, error: departmentsError } = useDepartmentOptions();
  const [roleId, setRoleId] = useState<string | null>(user?.role?.id ?? null);
  const [hotelIds, setHotelIds] = useState<string[]>(user?.hotels.map((h) => h.id) ?? []);
  const [departmentIds, setDepartmentIds] = useState<string[]>(
    user?.departments.map((d) => d.id) ?? [],
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Active roles, plus the user's current role if it has since been deactivated.
  const roleOptions = useMemo(() => {
    const options = roles.map((r) => ({ value: r.id, label: r.name }));
    if (user?.role && !options.some((o) => o.value === user.role?.id)) {
      options.push({ value: user.role.id, label: `${user.role.name} (inactive)` });
    }
    return options;
  }, [roles, user]);

  const hotelOptions = useMemo(
    () =>
      hotels.map((h) => ({
        value: h.id,
        label: h.isActive ? h.name : `${h.name} (inactive)`,
        description: `${h.code} · ${h.location.name}`,
      })),
    [hotels],
  );

  const departmentOptions = useMemo(() => {
    const options = departments.map((d) => ({
      value: d.id,
      label: d.isActive ? d.name : `${d.name} (inactive)`,
      description: d.code,
    }));
    // Keep the user's current departments visible even if they are not in the list.
    for (const d of user?.departments ?? []) {
      if (!options.some((o) => o.value === d.id)) {
        options.push({ value: d.id, label: d.name, description: d.code });
      }
    }
    return options;
  }, [departments, user]);

  const roleCode =
    roles.find((r) => r.id === roleId)?.code ??
    (roleId === user?.role?.id ? user?.role?.code : null);
  const isSuperAdmin = roleCode === SUPER_ADMIN_ROLE_CODE;
  const sameHotels = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id) => b.includes(id));
  const hotelsMissing = !isSuperAdmin && hotelIds.length === 0;

  async function save() {
    setFormError(null);
    try {
      if (user) {
        const changes = {
          ...(name.trim() !== user.name && { name }),
          ...(email.trim().toLowerCase() !== user.email && { email }),
          // Older users have no number yet; an empty box just leaves it as it is.
          ...(mobile.trim() && mobile.trim() !== (user.mobile ?? '') && { mobile }),
          ...(roleId && roleId !== user.role?.id && { roleId }),
          ...(!isSuperAdmin &&
            !sameHotels(
              hotelIds,
              user.hotels.map((h) => h.id),
            ) && { hotelIds }),
          ...(!sameHotels(
            departmentIds,
            user.departments.map((d) => d.id),
          ) && { departmentIds }),
        };
        if (hotelsMissing) return setErrors({ hotelIds: 'Choose at least one hotel' });
        if (departmentIds.length === 0) {
          return setErrors({ departmentIds: 'Choose at least one department' });
        }
        if (Object.keys(changes).length === 0) return onSaved();
        const parsed = updateUserSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await usersApi.update(user.id, parsed.data);
      } else {
        const parsed = createUserSchema.safeParse({
          name,
          email,
          mobile,
          roleId: roleId ?? '',
          hotelIds: isSuperAdmin ? [] : hotelIds,
          departmentIds,
          password,
        });
        if (!parsed.success || hotelsMissing || departmentIds.length === 0) {
          const fieldErrors = parsed.success ? {} : issuesToFieldErrors(parsed.error.issues);
          if (!roleId) fieldErrors.roleId = 'Choose a role';
          if (hotelsMissing) fieldErrors.hotelIds = 'Choose at least one hotel';
          if (departmentIds.length === 0) {
            fieldErrors.departmentIds = 'Choose at least one department';
          }
          return setErrors(fieldErrors);
        }
        setErrors({});
        setSaving(true);
        await usersApi.create(parsed.data);
      }
      onSaved();
    } catch (e) {
      const { fields, message } = apiErrorToForm(e, CODE_FIELDS);
      setErrors(fields);
      setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        locked ? undefined : (
          <Button
            title={editing ? 'Save changes' : 'Create user'}
            icon={editing ? 'check' : 'personAdd'}
            onPress={save}
            loading={saving}
          />
        )
      }
    >
      {formError ? <Banner message={formError} /> : null}
      <ReadOnly locked={locked}>
        {rolesError ? <Banner message={`Couldn't load roles: ${rolesError}`} /> : null}
        {hotelsError ? <Banner message={`Couldn't load hotels: ${hotelsError}`} /> : null}
        {departmentsError ? (
          <Banner message={`Couldn't load departments: ${departmentsError}`} />
        ) : null}

        <SectionLabel title="Details" />
        <Card>
          <TextField
            label="Full name"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="e.g. Priya Nair"
            autoCapitalize="words"
            autoComplete="off"
            editable={!saving}
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="name@thebyke.com"
            autoCapitalize="none"
            autoComplete="off"
            keyboardType="email-address"
            editable={!saving}
          />
          <TextField
            label="Mobile number"
            value={mobile}
            onChangeText={setMobile}
            error={errors.mobile}
            placeholder="10-digit number"
            keyboardType="phone-pad"
            autoComplete="off"
            maxLength={16}
            editable={!saving}
          />
        </Card>

        <SectionLabel title="Access" />
        <Card>
          <SelectField
            label="Role"
            value={roleId}
            options={roleOptions}
            onChange={setRoleId}
            placeholder="Choose a role"
            error={errors.roleId}
            hint={isSelf ? "You can't change your own role." : undefined}
            disabled={saving || isSelf}
          />
          {isSuperAdmin ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
              Super Admin can see every hotel.
            </ThemedText>
          ) : (
            <MultiSelectField
              label="Hotels"
              values={hotelIds}
              options={hotelOptions}
              onChange={(ids) => {
                setHotelIds(ids);
                if (ids.length) setErrors(({ hotelIds: _, ...rest }) => rest);
              }}
              placeholder="Choose hotels"
              searchPlaceholder="Search hotels"
              error={errors.hotelIds}
              hint="The user sees only these hotels."
              disabled={saving}
            />
          )}
          <MultiSelectField
            label="Departments"
            values={departmentIds}
            options={departmentOptions}
            onChange={(ids) => {
              setDepartmentIds(ids);
              if (ids.length) setErrors(({ departmentIds: _, ...rest }) => rest);
            }}
            placeholder="Choose departments"
            searchPlaceholder="Search departments"
            error={errors.departmentIds}
            hint="The teams this person works in. At least one."
            disabled={saving}
          />
          {editing ? null : (
            <TextField
              label="Temporary password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              hint="At least 8 characters with a letter and a number. Share it with the user."
              placeholder="At least 8 characters"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!saving}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  style={styles.toggle}
                >
                  <ThemedText style={styles.toggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </Pressable>
              }
            />
          )}
        </Card>
      </ReadOnly>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { paddingHorizontal: Spacing.two },
  note: { marginLeft: 2 },
  toggleText: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.primaryPressed },
});
