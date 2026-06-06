import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

/** Curva alinhada ao easing Slooti (0.22, 1, 0.36, 1) */
export const SLOOTI_EASE = CustomEase.create('slooti', '0.22,1,0.36,1');

export { gsap, CustomEase };
