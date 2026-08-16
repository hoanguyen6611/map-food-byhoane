import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from '@expo-google-fonts/archivo';
import { InterTight_500Medium, InterTight_600SemiBold } from '@expo-google-fonts/inter-tight';
import { Figtree_400Regular, Figtree_500Medium } from '@expo-google-fonts/figtree';

/**
 * Named font families for the "Ngon v3" visual language — Archivo for
 * headings/body, Inter Tight for buttons/nav labels, Figtree for
 * secondary/meta text (dates, counts). Loaded via `useFonts()` in App.tsx;
 * screens import this map alongside `useTheme()`'s `colors`.
 */
export const FONT_FAMILY = {
  heading: 'Archivo_700Bold',
  bodyBold: 'Archivo_700Bold',
  bodySemiBold: 'Archivo_600SemiBold',
  bodyMedium: 'Archivo_500Medium',
  body: 'Archivo_400Regular',

  button: 'InterTight_500Medium',
  buttonSemiBold: 'InterTight_600SemiBold',

  meta: 'Figtree_400Regular',
  metaMedium: 'Figtree_500Medium',
} as const;

export const FONTS_TO_LOAD = {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  InterTight_500Medium,
  InterTight_600SemiBold,
  Figtree_400Regular,
  Figtree_500Medium,
};
