// Public entry point of the hotels feature. Import from '@/features/hotels', not from inner files.
export { hotelsApi } from './api/hotels.api';
export { useHotelDetail, useHotelList, useHotelOptions } from './hooks/use-hotels';
export { HotelProvider, useHotel } from './context/hotel-provider';
export { HotelForm } from './components/hotel-form';
export { HotelListItem } from './components/hotel-list-item';
export { HotelSwitcher } from './components/hotel-switcher';
export { formatTime, TIME_OPTIONS } from './utils/time';
