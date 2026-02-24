# Análisis Crítico de Consumo de Tokens en NutriChat

## Resumen Ejecutivo

NutriChat utiliza 4 edge functions que llaman a Gemini 2.5 Flash vía Lovable AI Gateway. El análisis revela un **desperdicio estimado del 60-75% de tokens** debido a patrones de uso ineficientes, principalmente por el reenvío repetitivo del PDF completo en cada llamada.

---

## Endpoints de IA y consumo estimado

| Endpoint | Llamadas/día/usuario | Input estimado por llamada | Desperdicio principal |
|---|---|---|---|
| `chat/index.ts` | Hasta 9 (+ 9 pre-clasificador) | ~6,500 tokens | PDF completo en cada mensaje |
| `analyze-food-image/index.ts` | Hasta 3 | ~6,300+ tokens + imagen | PDF completo para analizar una foto |
| `upload-pdf/index.ts` | 1-2 (esporádico) | PDF en base64 (~10k-50k tokens) | PDF como "imagen" sin OCR previo |
| `generate-patient-summary/index.ts` | Esporádico | ~5k-20k tokens | 100 mensajes raw sin pre-procesamiento |

**Consumo diario estimado por usuario activo: ~80,000-120,000 tokens de input**
**Consumo diario optimizado teórico: ~20,000-30,000 tokens de input**

---

## Problema 1: PDF completo reenviado en CADA mensaje de chat

**Archivo:** `supabase/functions/chat/index.ts:206-225`
**Severidad:** CRÍTICA — representa ~70% del desperdicio total

El system prompt incluye el texto completo del PDF (`diet.pdf_text`) en cada llamada:

```typescript
const systemPrompt = `...
PLAN NUTRICIONAL DEL USUARIO:
${diet.pdf_text}`;
```

### Impacto numérico

- PDF promedio: ~3,000-10,000 tokens (estimando ~5,000)
- Llamadas de chat al día: hasta 9 por usuario
- **Tokens desperdiciados: ~45,000 tokens/usuario/día solo por repetir el PDF**
- El system prompt fijo (~500 tokens) también se repite 9 veces: ~4,500 tokens adicionales

### Agravante: doble llamada por mensaje

Cada mensaje genera 2 llamadas a la IA:
1. Pre-clasificador (`classifyMessage`, línea 165): ~100 tokens input + ~3 tokens output
2. Chat principal (línea 251): ~6,500 tokens input + ~500 tokens output

El pre-clasificador es barato individualmente (~100 tokens), pero suma ~900 tokens/día/usuario en una función que podría resolverse sin IA (regex, keyword matching, o un modelo local tiny).

---

## Problema 2: PDF completo enviado para analizar fotos de comida

**Archivo:** `supabase/functions/analyze-food-image/index.ts:95-98`
**Severidad:** ALTA

```typescript
const systemPrompt = `...
PLAN NUTRICIONAL DEL USUARIO:
${diet.pdf_text}
...`;
```

Para determinar si un plato de pollo con ensalada está alineado con el plan, se envía el PDF completo (~5,000 tokens) cuando probablemente bastaría con un resumen de ~500 tokens con las reglas alimentarias clave.

### Impacto numérico

- 3 imágenes/día × 5,000 tokens de PDF = **15,000 tokens desperdiciados/día/usuario**
- El prompt de imagen ya es costoso por la imagen en sí; agregar el PDF completo lo multiplica

### Bug adicional detectado

En la línea 78 se usa `supabaseClient` que **no está definido** en este archivo (solo existe `supabaseAdmin`). Esto causaría un error runtime al intentar buscar la dieta.

```typescript
// Línea 78 — BUG: supabaseClient no está definido en este scope
const { data: diet, error: dietError } = await supabaseClient
  .from("diets")
  .select("*")
  .eq("id", dietId)
  .eq("user_id", userId)
  .single();
```

---

## Problema 3: Extracción de PDF enviando base64 completo como "imagen"

**Archivo:** `supabase/functions/upload-pdf/index.ts:129-152`
**Severidad:** ALTA (costo unitario muy elevado)

```typescript
body: JSON.stringify({
  model: "google/gemini-2.5-flash",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Extrae TODO el texto completo..." },
      { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdf}` } }
    ]
  }],
  max_tokens: 16000,   // Output potencialmente enorme
}),
```

### Problemas específicos

1. **PDF enviado como base64 vía `image_url`**: Los PDFs en base64 son ~33% más grandes que el binario original. Un PDF de 5MB se convierte en ~6.7MB de base64, que Gemini tokeniza de forma costosa.
2. **`max_tokens: 16000`**: Permite una respuesta de hasta 16k tokens (~12,000 palabras). La mayoría de planes nutricionales no necesitan tanto.
3. **Sin validación del tipo de contenido**: No verifica que el PDF realmente contenga un plan nutricional antes de gastar tokens.
4. **Una sola llamada monolítica**: PDFs grandes podrían beneficiarse de procesamiento por páginas.

### Impacto numérico

- Input: ~10,000-50,000 tokens por PDF (dependiendo del tamaño)
- Output: hasta 16,000 tokens
- Es un costo único por PDF, pero es la llamada individual más cara del sistema

---

## Problema 4: 100 mensajes raw sin pre-procesamiento para resumen médico

**Archivo:** `supabase/functions/generate-patient-summary/index.ts:89-109`
**Severidad:** MEDIA-ALTA

```typescript
const { data: messages } = await serviceClient
  .from('chat_messages')
  .select('content, role, created_at')
  .eq('user_id', patient_id)
  .order('created_at', { ascending: false })
  .limit(100);   // ← 100 mensajes raw

const chatHistory = messages.reverse().map(m => 
  `${m.role === 'user' ? 'Paciente' : 'Asistente'}: ${m.content}`
).join('\n\n');
```

### Problemas específicos

1. **100 mensajes sin filtrar**: Incluye mensajes triviales ("Gracias", "Ok", "Hola") que no aportan valor clínico.
2. **Sin `max_tokens`**: La llamada a la IA no limita la respuesta (línea 117-148). Queda a discreción del modelo, que podría generar respuestas largas.
3. **Sin resumen incremental**: Cada vez que se genera un resumen se reenvían TODOS los mensajes, incluso los que ya fueron analizados en un resumen anterior.
4. **Formato verbose**: El formato `Paciente: {contenido}\n\nAsistente: {contenido}` agrega overhead por los prefijos y doble salto de línea.

### Impacto numérico

- 100 mensajes × ~100 tokens promedio = ~10,000 tokens de historial
- System prompt: ~200 tokens
- **Total: ~10,200 tokens input por resumen**
- Si el doctor pide múltiples resúmenes en un día, el costo se multiplica sin beneficio

---

## Problema 5: No se aprovecha context caching de Gemini

**Afecta a:** `chat/index.ts`, `analyze-food-image/index.ts`
**Severidad:** ALTA (oportunidad perdida de ahorro ~75%)

Gemini 2.5 Flash soporta **context caching**: se puede almacenar un contexto (como el system prompt + PDF) y reutilizarlo en múltiples llamadas pagando solo una fracción del costo.

- Tokens cacheados cuestan ~75% menos que tokens normales de input
- El system prompt + PDF es idéntico en todas las llamadas de un mismo usuario para una misma dieta
- **Ahorro potencial: ~75% del costo de input en chat e imágenes**

Actualmente cada llamada envía el contexto completo desde cero.

---

## Problema 6: No hay tracking de tokens consumidos

**Afecta a:** Todos los endpoints
**Severidad:** MEDIA

Ningún endpoint registra los tokens consumidos. La API de Lovable/Gemini devuelve `usage` en la respuesta (con `prompt_tokens`, `completion_tokens`, `total_tokens`) pero este dato se ignora completamente.

Sin tracking es imposible:
- Saber cuánto cuesta cada usuario realmente
- Detectar anomalías de consumo
- Optimizar basándose en datos reales
- Establecer limits por costo en vez de por cantidad de mensajes

---

## Problema 7: Historial de chat sin compresión

**Archivo:** `supabase/functions/chat/index.ts:197-247`
**Severidad:** MEDIA

```typescript
const { data: recentMessages } = await supabaseClient
  .from("chat_messages")
  .select("role, content")
  .eq("diet_id", dietId)
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(10);   // ← 10 mensajes completos
```

- Se envían los últimos 10 mensajes completos sin ninguna compresión
- Los mensajes del asistente son típicamente largos (~200-500 tokens cada uno)
- **10 mensajes × ~150 tokens promedio = ~1,500 tokens de historial por llamada**
- El historial crece linealmente: en el mensaje 9 se envían 18 mensajes previos de contexto innecesario

---

## Tabla resumen de desperdicios

| Problema | Tokens desperdiciados/día/usuario | % del total |
|---|---|---|
| PDF repetido en chat (9×) | ~40,000 | 50% |
| PDF repetido en imágenes (3×) | ~15,000 | 19% |
| Context caching no utilizado | ~12,000 (ahorro perdido) | 15% |
| Historial sin comprimir | ~5,000 | 6% |
| Resumen de 100 msgs raw | ~5,000 (por resumen) | 6% |
| Pre-clasificador por IA | ~900 | 1% |
| Sin tracking (costo oculto) | Indeterminado | — |

**Total estimado de desperdicio: ~78,000 tokens/día/usuario activo**

---

## Estimación de costos (Gemini 2.5 Flash)

Asumiendo pricing de Gemini 2.5 Flash:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

| Escenario | Tokens input/día | Tokens output/día | Costo/día | Costo/mes (30 días) |
|---|---|---|---|---|
| 100 usuarios activos (actual) | 10M | 2M | $2.70 | $81 |
| 100 usuarios activos (optimizado) | 2.5M | 2M | $1.58 | $47 |
| 1,000 usuarios activos (actual) | 100M | 20M | $27.00 | $810 |
| 1,000 usuarios activos (optimizado) | 25M | 20M | $15.75 | $473 |

**Ahorro potencial: ~40-60% del costo total con optimizaciones de input.**

> Nota: estos cálculos son estimaciones conservadoras. El costo real de imágenes y PDFs en base64 puede ser significativamente mayor.
