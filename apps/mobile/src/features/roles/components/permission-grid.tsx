import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  permissionName,
  type PermissionAction,
  type Role,
} from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/form-errors';
import { rolesApi } from '../api/roles.api';

const ACTION_LABEL: Record<PermissionAction, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
};

/**
 * Plan 06: what a role may do. One row per module, a tick per action. Ticking Add / Edit / Delete
 * also ticks View; unticking View clears the rest of that module. Saved on its own button.
 */
export function PermissionGrid({ role, onSaved }: { role: Role; onSaved: (role: Role) => void }) {
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const dirty =
    selected.length !== role.permissions.length ||
    selected.some((p) => !role.permissions.includes(p));

  function toggle(noun: (typeof PERMISSION_MODULES)[number]['noun'], action: PermissionAction) {
    setSavedNote(false);
    const name = permissionName(action, noun);
    const view = permissionName('view', noun);
    setSelected((current) => {
      if (current.includes(name)) {
        // Unticking View clears the whole module.
        const drop: string[] =
          action === 'view' ? PERMISSION_ACTIONS.map((a) => permissionName(a, noun)) : [name];
        return current.filter((p) => !drop.includes(p));
      }
      return [...current, name, ...(current.includes(view) ? [] : [view])].filter(
        (p, i, all) => all.indexOf(p) === i,
      );
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await rolesApi.update(role.id, { permissions: selected }));
      setSavedNote(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionLabel title="Permissions" />
      {error ? <Banner message={error} /> : null}
      <Card>
        <View style={styles.row}>
          <View style={styles.name} />
          {PERMISSION_ACTIONS.map((a) => (
            <ThemedText key={a} style={[styles.head, styles.cell]}>
              {ACTION_LABEL[a]}
            </ThemedText>
          ))}
        </View>
        {PERMISSION_MODULES.map((m) => (
          <View key={m.key} style={styles.row}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {m.label}
            </ThemedText>
            {PERMISSION_ACTIONS.map((a) => {
              const on = selected.includes(permissionName(a, m.noun));
              return (
                <View key={a} style={styles.cell}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: saving }}
                    accessibilityLabel={`${ACTION_LABEL[a]} ${m.label}`}
                    disabled={saving}
                    hitSlop={8}
                    onPress={() => toggle(m.noun, a)}
                    style={[styles.box, on && styles.boxOn]}
                  >
                    {on ? <Icon name="check" size={16} color="#fff" /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </Card>
      <ThemedText type="caption" themeColor="textSecondary">
        Add, Edit and Delete need View. Changes apply to users with this role right away.
      </ThemedText>
      <Button
        title={savedNote && !dirty ? 'Saved' : 'Save permissions'}
        icon="check"
        onPress={save}
        loading={saving}
        disabled={!dirty}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  name: { flex: 1.9, fontFamily: FontFamily.medium, fontSize: 14, paddingRight: Spacing.two },
  head: { fontFamily: FontFamily.semiBold, fontSize: 12, color: Colors.textSecondary },
  cell: { flex: 1, alignItems: 'center' },
  box: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
