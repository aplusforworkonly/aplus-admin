export const CAMPUSES = ['文府總校', '龍華校', '左新校'] as const;
export type Campus = (typeof CAMPUSES)[number];
