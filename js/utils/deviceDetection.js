export const isTouchDevice=()=>matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
