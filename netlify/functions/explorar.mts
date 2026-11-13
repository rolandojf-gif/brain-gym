/* /api/explorar: la IA contrasta la hipótesis del usuario sobre una pregunta propia (Fase 3, curiosidades).
   Protegida con BG_TOKEN, gasta una llamada del cupo diario general (la pide el usuario, como el Abogado del Diablo)
   y sólo devuelve las fuentes cuya URL responde: una referencia inventada se cae aquí y no llega a la app. */
import type { Config } from '@netlify/functions';
import { MAX_TOKENS_IA, MODELO_IA_POR_DEFECTO } from '../../src/dominio/ia';
import { ErrorExplorar, parsearExploracion, payloadExplorar, validarPeticionExplorar, type PeticionExplorar } from '../../src/dominio/explorar';
import { ErrorServidor, autorizado, comprobarFuente, json, leerEnv, llamarConCupo } from '../servidor';

const MAX_CUERPO = 4000;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!autorizado(req.headers.get('authorization'))) return json({ error: 'No autorizado' }, 401);

  let peticion: PeticionExplorar;
  try {
    const crudo = await req.text();
    if (crudo.length > MAX_CUERPO) return json({ error: 'Petición demasiado grande' }, 400);
    peticion = validarPeticionExplorar(JSON.parse(crudo));
  } catch (e) {
    return json({ error: e instanceof ErrorExplorar ? e.message : 'Petición mal formada' }, 400);
  }

  const model = leerEnv('OPENROUTER_MODEL') ?? MODELO_IA_POR_DEFECTO;
  try {
    if (!leerEnv('OPENROUTER_API_KEY')) throw new ErrorServidor(500, 'Falta configurar OPENROUTER_API_KEY en el servidor de Netlify');
    const { texto, finishReason } = await llamarConCupo(payloadExplorar(model, peticion));
    if (finishReason === 'length') {
      return json({ error: `La exploración de ${model} se cortó al llegar a ${MAX_TOKENS_IA} tokens. Vuelve a intentarlo.` }, 502);
    }
    let respuesta;
    try {
      respuesta = parsearExploracion(texto);
    } catch (e) {
      return json({ error: `${e instanceof Error ? e.message : 'Formato inválido'} (modelo: ${model})` }, 502);
    }
    // En paralelo: tres fuentes lentas no deben sumar sus tiempos.
    const comprobadas = await Promise.all(respuesta.fuentes.map(async (f) => ((await comprobarFuente(f.url)).ok ? f : null)));
    const fuentes = comprobadas.filter((f) => f !== null);
    return json({ ...respuesta, fuentes, descartadas: respuesta.fuentes.length - fuentes.length, modelo: model });
  } catch (e) {
    if (e instanceof ErrorServidor) return json({ error: e.message }, e.status);
    throw e;
  }
};

export const config: Config = { path: '/api/explorar' };
