// Public entry point of the rooms feature. Import from '@/features/rooms'.
export { roomsApi } from './api/rooms.api';
export { useRoomCounts, useRoomDetail, useRoomList } from './hooks/use-rooms';
export { RoomForm } from './components/room-form';
export { BulkRoomsForm } from './components/bulk-rooms-form';
export { RoomListItem } from './components/room-list-item';
