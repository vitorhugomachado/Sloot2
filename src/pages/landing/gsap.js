import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

/** Curva alinhada ao easing Slooti (0.22, 1, 0.36, 1) */
export const SLOOTI_EASE = CustomEase.create('slooti', '0.22,1,0.36,1');

/** Curva do underlay nav (referência Webflow) */
export const ENERGY_EASE = CustomEase.create('energy', 'M0,0 C0.32,0.72 0,1 1,1');

export { gsap, CustomEase };
