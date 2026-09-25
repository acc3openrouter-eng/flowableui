import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';

/** Aura with a primary palette close to the Flowable brand blue. */
export const FlowablePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef6fc',
      100: '#d5e9f7',
      200: '#abd3ef',
      300: '#78b7e3',
      400: '#4596d3',
      500: '#2479bd',
      600: '#1a619f',
      700: '#174f81',
      800: '#16436a',
      900: '#153958',
      950: '#0d243a',
    },
  },
});
