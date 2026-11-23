import { Platform } from 'react-native';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** An Excel file the user picked; `toForm` makes the multipart body to upload it. */
export type PickedExcel = { name: string; toForm: () => FormData };

/** Lets the user choose one .xlsx file (must run from a tap). Null if they cancel. */
export async function pickExcel(): Promise<PickedExcel | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: [XLSX],
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  // On web, read the bytes now (the picker's File, or the blob behind its URI) so the upload
  // doesn't depend on the picker's temporary input or URL still being alive.
  let webFile: Blob | null = null;
  if (Platform.OS === 'web') {
    const source = asset.file ?? (await (await fetch(asset.uri)).blob());
    webFile = new Blob([await source.arrayBuffer()], { type: XLSX });
  }
  return {
    name: asset.name,
    toForm: () => {
      const form = new FormData();
      if (webFile) {
        form.append('file', webFile, asset.name);
      } else {
        // React Native's FormData reads the file from the URI.
        form.append('file', { uri: asset.uri, name: asset.name, type: XLSX } as unknown as Blob);
      }
      return form;
    },
  };
}

/** Gives the user a downloaded file: a browser download on web, the share sheet on phones. */
export async function saveFile(name: string, data: ArrayBuffer): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([data], { type: XLSX }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(new Uint8Array(data));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: XLSX,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: name,
    });
  }
}
