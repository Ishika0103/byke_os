import { Platform } from 'react-native';
import type {
  CreatedTasks,
  CreateTaskInput,
  Department,
  Paginated,
  Task,
  TaskMaster,
  TaskActionInput,
  TaskDetail,
  TaskSummary,
  TaskView,
  UpdateTaskInput,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type TaskListParams = {
  page?: number;
  limit?: number;
  q?: string;
  view?: TaskView;
  departmentId?: string;
  assigneeId?: string;
  roomId?: string;
  overdue?: boolean;
};

/** A picked photo (from expo-image-picker). */
export type PickedPhoto = { uri: string; mimeType?: string | null; fileName?: string | null };

const base = (hotelId: string) => `/hotels/${hotelId}/tasks`;

/** Backend calls for tasks. Mirrors apps/api/src/modules/tasks (+ uploads). */
export const tasksApi = {
  list: (hotelId: string, params: TaskListParams = {}) =>
    apiClient.get<Paginated<Task>>(`${base(hotelId)}${toQueryString(params)}`),
  summary: (hotelId: string) => apiClient.get<TaskSummary>(`${base(hotelId)}/summary`),
  get: (hotelId: string, id: string) => apiClient.get<TaskDetail>(`${base(hotelId)}/${id}`),
  create: (hotelId: string, input: CreateTaskInput) =>
    apiClient.post<CreatedTasks>(base(hotelId), input),
  update: (hotelId: string, id: string, input: UpdateTaskInput) =>
    apiClient.patch<TaskDetail>(`${base(hotelId)}/${id}`, input),
  act: (hotelId: string, id: string, input: TaskActionInput) =>
    apiClient.post<TaskDetail>(`${base(hotelId)}/${id}/actions`, input),

  /** The predefined task titles (seeded, read-only). */
  masters: () => apiClient.get<TaskMaster[]>('/task-masters'),
  /** Active departments for the pickers. */
  departments: () => apiClient.get<Paginated<Department>>('/departments?limit=100&isActive=true'),

  /** Uploads one photo and returns its URL path, to send with the "done" step. */
  async uploadPhoto(hotelId: string, photo: PickedPhoto): Promise<string> {
    const type = photo.mimeType ?? 'image/jpeg';
    const name = photo.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
    const form = new FormData();
    if (Platform.OS === 'web') {
      // On web the picker gives a blob: / data: URI; send the actual file.
      form.append('file', await (await fetch(photo.uri)).blob(), name);
    } else {
      // React Native's FormData reads the file from the URI.
      form.append('file', { uri: photo.uri, name, type } as unknown as Blob);
    }
    const { url } = await apiClient.upload<{ url: string }>(`/hotels/${hotelId}/uploads`, form);
    return url;
  },
};
