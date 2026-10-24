import { describe, expect, it } from 'vitest';
import { ajustesPorDefecto } from './ajustes';
import { nuevaTarjeta } from './fsrs';
import { nuevo } from './registro';
import { idSesion, registrarSesion, sesionDeHoy, sumarDias } from './sesion';
import type { Actividad, Sesion } from './tipos';

// Fechas en hora local: el día lógico depende de la zona del dispositivo.
const lunes = new Date(2026, 9, 26, 18, 0);
const ajustes = ajustesPorDefecto(lunes);
const sesion = (dia: string, actividad: Actividad): Sesion =>
  nuevo({ dia, actividad, inicio: `${dia}T10:00:00Z`, segundos: 600 }, lunes);
const vacio = { sesiones: [], tarjetas: [], predicciones: [] };

describe('sesionDeHoy', () => {
  it('el lunes toca estudio, repaso y concepto', () => {
    const s = sesionDeHoy(lunes, ajustes, vacio);
    expect(s.dia).toBe('2026-10-26');
    expect(s.actividades.map((a) => a.actividad)).toEqual(['estudio', 'repaso', 'concepto']);
    expect(s.actividades.every((a) => !a.hecha)).toBe(true);
  });

  it('el martes toca lectura', () => {
    const s = sesionDeHoy(new Date(2026, 9, 27, 18), ajustes, vacio);
    expect(s.actividades[0]?.actividad).toBe('lectura');
  });

  it('la madrugada del martes sigue siendo el lunes', () => {
    const s = sesionDeHoy(new Date(2026, 9, 27, 1, 30), ajustes, vacio);
    expect(s.dia).toBe('2026-10-26');
    expect(s.actividades[0]?.actividad).toBe('estudio');
  });

  it('marca lo hecho hoy y no lo de otros días', () => {
    const s = sesionDeHoy(lunes, ajustes, { ...vacio, sesiones: [sesion('2026-10-26', 'estudio'), sesion('2026-10-25', 'repaso')] });
    expect(s.actividades.find((a) => a.actividad === 'estudio')?.hecha).toBe(true);
    expect(s.actividades.find((a) => a.actividad === 'repaso')?.hecha).toBe(false);
  });

  it('las sesiones no hechas de días anteriores no se arrastran', () => {
    const s = sesionDeHoy(new Date(2026, 9, 27, 18), ajustes, vacio);
    expect(s.actividades.map((a) => a.actividad)).not.toContain('estudio');
  });

  it('incluye tarjetas vencidas', () => {
    const s = sesionDeHoy(lunes, ajustes, { ...vacio, tarjetas: [nuevaTarjeta('a', 'b', lunes)] });
    expect(s.pendiente.tarjetasVencidas).toHaveLength(1);
  });

  it('la calibración es pendiente si no se ha hecho en 7 días y hoy no toca', () => {
    expect(sesionDeHoy(lunes, ajustes, vacio).pendiente.calibracionAtrasada).toBe(true);
    const hecha = { ...vacio, sesiones: [sesion('2026-10-25', 'calibracion')] };
    expect(sesionDeHoy(lunes, ajustes, hecha).pendiente.calibracionAtrasada).toBe(false);
    const vieja = { ...vacio, sesiones: [sesion('2026-10-19', 'calibracion')] };
    expect(sesionDeHoy(lunes, ajustes, vieja).pendiente.calibracionAtrasada).toBe(true);
  });

  it('el domingo la calibración va en el plan, no como pendiente', () => {
    const s = sesionDeHoy(new Date(2026, 10, 1, 18), ajustes, vacio);
    expect(s.actividades.map((a) => a.actividad)).toContain('calibracion');
    expect(s.pendiente.calibracionAtrasada).toBe(false);
  });

  it('respeta un plan editado', () => {
    const otro = { ...ajustes, planSemanal: { ...ajustes.planSemanal, 0: ['lectura' as const] } };
    expect(sesionDeHoy(lunes, otro, vacio).actividades.map((a) => a.actividad)).toEqual(['lectura']);
  });
});

describe('sumarDias', () => {
  it('cruza meses, años y el cambio de hora', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('registrarSesion', () => {
  it('crea la sesión del día con id fijo y acumula tiempo', () => {
    const a = registrarSesion(undefined, '2026-10-26', 'estudio', 600, lunes);
    expect(a.id).toBe(idSesion('2026-10-26', 'estudio'));
    const b = registrarSesion(a, '2026-10-26', 'estudio', 300, new Date(lunes.getTime() + 1000));
    expect(b.segundos).toBe(900);
    expect(b.actualizado > a.actualizado).toBe(true);
  });
});
