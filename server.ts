import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Simple TTL in-memory cache so upstream APIs stay fast and respectful
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const SPANISH_BIBLE_VERSIONS = [
  { id: 'RV1960', name: 'Reina-Valera 1960', short: 'RV1960', year: '1960' },
  { id: 'NVI', name: 'Nueva Versión Internacional', short: 'NVI', year: '2015' },
  { id: 'NTV', name: 'Nueva Traducción Viviente', short: 'NTV', year: '2009' },
  { id: 'LBLA', name: 'La Biblia de las Américas', short: 'LBLA', year: '1997' },
  { id: 'PDT', name: 'Palabra de Dios para Todos', short: 'PDT', year: '2005' },
  { id: 'BTX3', name: 'La Biblia Textual 3ª Ed.', short: 'BTX3', year: '2010' },
  { id: 'NTBT', name: 'Nueva Traducción BibliaTodo', short: 'NTBT', year: '2024' },
  { id: 'RV2004', name: 'Reina-Valera Gómez 2004', short: 'RV2004', year: '2004' },
];

const CURATED_ADVENTIST_VIDEOS = [
  // Prédicas Adventistas (Alejandro Bullón, Joel Flores, Robert Costa, Bruno Raso, Esteban Bohr)
  {
    id: 'pred_bullon_1',
    youtubeId: 'gTYXZkadWq0',
    title: 'El cambio que tanto necesitas',
    caption: 'Prédica adventista sobre transformación espiritual y esperanza en Cristo.',
    authorId: 'pr_bullon',
    authorName: 'Pr. Alejandro Bullón',
    authorHandle: 'alejandrobullon',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '44:07',
  },
  {
    id: 'pred_bullon_2',
    youtubeId: 'cBGi2uZEUB4',
    title: 'Deja de preocuparte — Confía en Dios',
    caption: 'Mensaje de paz para momentos de ansiedad e incertidumbre.',
    authorId: 'pr_bullon',
    authorName: 'Pr. Alejandro Bullón',
    authorHandle: 'alejandrobullon',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '44:31',
  },
  {
    id: 'pred_bullon_3',
    youtubeId: 'ToB4upSXieE',
    title: 'Transforma tu vida: Activa la fe y elimina el temor',
    caption: 'Cómo caminar cada día de la mano del Señor con fe renovada.',
    authorId: 'pr_bullon',
    authorName: 'Pr. Alejandro Bullón',
    authorHandle: 'alejandrobullon',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '35:34',
  },
  {
    id: 'pred_bullon_4',
    youtubeId: 'HsSegTSceCA',
    title: 'Cómo convivir en paz',
    caption: 'Principios bíblicos para el hogar, la iglesia y la vida diaria.',
    authorId: 'pr_bullon',
    authorName: 'Pr. Alejandro Bullón',
    authorHandle: 'alejandrobullon',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '52:10',
  },
  {
    id: 'pred_joel_1',
    youtubeId: 'cFsaDzzwj0s',
    title: 'Nunca vivas un solo día separado de Jesús',
    caption: 'Llamado devocional a permanecer unidos a Cristo cada mañana.',
    authorId: 'pr_joel',
    authorName: 'Pr. Joel Flores',
    authorHandle: 'joelflores',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '1:04:14',
  },
  {
    id: 'pred_joel_2',
    youtubeId: 'PDtD6Ui35go',
    title: 'Confía en Dios en momentos difíciles',
    caption: 'Sermón adventista de fortaleza y esperanza bíblica.',
    authorId: 'pr_joel',
    authorName: 'Pr. Joel Flores',
    authorHandle: 'joelflores',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '24:56',
  },
  {
    id: 'pred_joel_3',
    youtubeId: 'm0aXArtUyDw',
    title: '¿Cómo será la angustia final? · Serie Profecías de Daniel',
    caption: 'Estudio profético sobre el tiempo del fin y las promesas de liberación.',
    authorId: 'pr_joel',
    authorName: 'Pr. Joel Flores',
    authorHandle: 'joelflores',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Biblia',
    duration: '50:15',
  },
  {
    id: 'pred_costa_1',
    youtubeId: 'xegxW4nnqMg',
    title: 'Escrito Está: ¿Dónde está Dios?',
    caption: 'Reflexión profunda sobre la presencia de Dios en medio de las pruebas.',
    authorId: 'pr_costa',
    authorName: 'Pr. Robert Costa',
    authorHandle: 'escritoes',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '28:30',
  },
  {
    id: 'pred_costa_2',
    youtubeId: '5Eijv7gMZnY',
    title: 'Escrito Está: La diferencia que marca la fe',
    caption: 'Historias reales y lecciones bíblicas que transforman el corazón.',
    authorId: 'pr_costa',
    authorName: 'Pr. Robert Costa',
    authorHandle: 'escritoes',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '28:30',
  },
  {
    id: 'pred_costa_3',
    youtubeId: 'wDcpuj74mCo',
    title: 'Escrito Está: Se pronostican tormentas',
    caption: 'Cómo anclar tu vida en la Roca cuando llegan las crisis.',
    authorId: 'pr_costa',
    authorName: 'Pr. Robert Costa',
    authorHandle: 'escritoes',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
    duration: '28:32',
  },
  {
    id: 'pred_raso_1',
    youtubeId: 'EqyXqzKr95s',
    title: 'No temas — Dios camina contigo',
    caption: 'Mensaje de fe y misión con el Pr. Bruno Raso.',
    authorId: 'pr_raso',
    authorName: 'Pr. Bruno Raso',
    authorHandle: 'brunoraso',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
  },
  {
    id: 'pred_raso_2',
    youtubeId: 'SQplLPF8NE4',
    title: 'La sangre de Cristo',
    caption: 'Estudio cristocéntrico sobre la salvación y el sacrificio de Jesús.',
    authorId: 'pr_raso',
    authorName: 'Pr. Bruno Raso',
    authorHandle: 'brunoraso',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
  },
  {
    id: 'pred_bohr_1',
    youtubeId: 'ZpZ4woD4SDA',
    title: 'El Sábado y la Gran Prueba Final',
    caption: 'Serie En Defensa de la Fe · Estudio bíblico y profético.',
    authorId: 'pr_bohr',
    authorName: 'Pr. Esteban Bohr',
    authorHandle: 'estebanbohr',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Biblia',
  },
  {
    id: 'pred_bohr_2',
    youtubeId: 'BcSPOTHoP8U',
    title: 'A los que a Dios aman — Culto Divino',
    caption: 'Mensaje de adoración y fidelidad basado en Romanos 8:28.',
    authorId: 'pr_bohr',
    authorName: 'Pr. Esteban Bohr',
    authorHandle: 'estebanbohr',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Predicas',
  },
  {
    id: 'est_daniel_1',
    youtubeId: 'B89B_TeBFKg',
    title: 'Cómo estudiar Daniel y Apocalipsis · Los secretos de la Profecía',
    caption: 'Claves bíblicas para comprender las profecías de Daniel y Apocalipsis.',
    authorId: 'pr_bohr',
    authorName: 'Pr. Esteban Bohr',
    authorHandle: 'estebanbohr',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Biblia',
    duration: '1:00:44',
  },
  {
    id: 'mus_adoradores_1',
    youtubeId: '1j3xCxmoYj0',
    title: 'Digno',
    caption: 'Adoradores 5 · Grabadora Nuevo Tiempo.',
    authorId: 'grabadora_nt',
    authorName: 'Adoradores 5 · Grabadora Nuevo Tiempo',
    authorHandle: 'grabadorant',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Musica',
    duration: '5:16',
  },
  {
    id: 'mus_adoradores_2',
    youtubeId: 'pviTMq80dXY',
    title: 'Santuario en el Tiempo — Adoradores',
    caption: 'Canto adventista sobre el sábado como santuario en el tiempo.',
    authorId: 'grabadora_nt',
    authorName: 'Grabadora Nuevo Tiempo',
    authorHandle: 'grabadorant',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Musica',
    duration: '4:39',
  },
];

const FALLBACK_SHORTS = [
  {
    id: 'UPqN_ht-4dM',
    youtubeId: 'UPqN_ht-4dM',
    title: '¡Llevas mucho tiempo luchando! Escucha esto',
    caption: 'Dios ve cada batalla silenciosa que estás enfrentando hoy. No te sueltes de su mano.',
    authorId: 'nt_oficial',
    authorName: 'TV Nuevo Tiempo',
    authorHandle: 'nuevotiempotv',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Reflexion',
  },
  {
    id: 'GioAbdDbuqE',
    youtubeId: 'GioAbdDbuqE',
    title: '¿Por qué Dios guarda silencio cuando más lo necesitas?',
    caption: 'El silencio de Dios no es ausencia; muchas veces es preparación para un milagro mayor.',
    authorId: 'nt_oficial',
    authorName: 'TV Nuevo Tiempo',
    authorHandle: 'nuevotiempotv',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Biblia',
  },
  {
    id: 'XmN4eLJbnNo',
    youtubeId: 'XmN4eLJbnNo',
    title: '¿Cómo perdonar a quien no lo merece?',
    caption: 'El perdón libera primero tu propio corazón y te acerca al carácter de Jesús.',
    authorId: 'pr_daniel',
    authorName: 'Pr. Daniel Mendoza',
    authorHandle: 'pr.danielmendoza',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'Reflexion',
  },
  {
    id: '8eYxkdV0ZIc',
    youtubeId: '8eYxkdV0ZIc',
    title: '¿Adoras a Dios o solo dices que lo haces?',
    caption: 'La verdadera adoración transforma lunes a viernes, no solo el sábado por la mañana.',
    authorId: 'camila_jovenes',
    authorName: 'Camila Ríos',
    authorHandle: 'camilarios.ja',
    authorAvatar: '/src/assets/images/creator_avatar_youth_1794943381952.jpg',
    category: 'Jovenes',
  },
  {
    id: 'stcAJ5NL4ts',
    youtubeId: 'stcAJ5NL4ts',
    title: '¿Qué necesitas soltar para ser libre?',
    caption: 'Entrega tus cargas en oración hoy. Mateo 11:28 sigue vigente para ti.',
    authorId: 'nt_oficial',
    authorName: 'TV Nuevo Tiempo',
    authorHandle: 'nuevotiempotv',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Testimonio',
  },
  {
    id: 'Q2Dyylym-pA',
    youtubeId: 'Q2Dyylym-pA',
    title: '¿Caíste otra vez? ¡Dios no te abandona!',
    caption: 'Su gracia es más grande que tu tropiezo. Levántate con fe esta semana.',
    authorId: 'pr_daniel',
    authorName: 'Pr. Daniel Mendoza',
    authorHandle: 'pr.danielmendoza',
    authorAvatar: '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
    category: 'EscuelaSabatica',
  },
  {
    id: 'HFk1quGrOMk',
    youtubeId: 'HFk1quGrOMk',
    title: '¡Tu encuentro con Jesús no es casualidad!',
    caption: 'Cada paso en tu historia ha sido guiado con propósito eterno.',
    authorId: 'camila_jovenes',
    authorName: 'Camila Ríos',
    authorHandle: 'camilarios.ja',
    authorAvatar: '/src/assets/images/creator_avatar_youth_1794943381952.jpg',
    category: 'Musica',
  },
  {
    id: '2X7tKb0B7co',
    youtubeId: '2X7tKb0B7co',
    title: '¿Cómo salir de una crisis que parece no tener fin?',
    caption: 'Salmos 46: Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.',
    authorId: 'nt_oficial',
    authorName: 'TV Nuevo Tiempo',
    authorHandle: 'nuevotiempotv',
    authorAvatar: '/src/assets/images/maranata_emblem_1794943377605.jpg',
    category: 'Biblia',
  },
  ...CURATED_ADVENTIST_VIDEOS,
];

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MaranataAdventistApp/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Upstream error ${res.status} for ${url}`);
  }
  return res.json();
}

async function resolveNuevoTiempoLive() {
  const cached = getCache<{
    videoId: string;
    title: string;
    isLive: boolean;
    channelHandle: string;
    channelUrl: string;
    recentStreams: Array<{ videoId: string; title: string }>;
  }>('nt_live');
  if (cached) return cached;

  let videoId = 'NfwdLxxM5e8';
  let title = 'Transmisión en vivo de TV Nuevo Tiempo';
  const isLive = true;
  const recentStreams: Array<{ videoId: string; title: string }> = [];

  try {
    // Verify title via oembed for the official 24/7 live stream
    try {
      const mainOe = (await fetchJson(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )) as { title?: string };
      if (mainOe.title) title = mainOe.title;
    } catch {
      // keep default title
    }

    // Fetch recent streams from /streams for secondary quick switch
    const streamsHtml = await (
      await fetch('https://www.youtube.com/@nuevotiempotv/streams', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es-ES,es;q=0.9' },
      })
    ).text();
    const seen = new Set<string>([videoId]);
    for (const m of streamsHtml.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        recentStreams.push({ videoId: id, title: 'Programa TV Nuevo Tiempo' });
        if (recentStreams.length >= 4) break;
      }
    }

    // Enrich recent stream titles via oembed
    await Promise.all(
      recentStreams.map(async (item) => {
        try {
          const oe = (await fetchJson(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.videoId}&format=json`
          )) as { title?: string };
          if (oe.title) item.title = oe.title;
        } catch {
          // keep default title
        }
      })
    );
  } catch (err) {
    console.error('Error resolving Nuevo Tiempo live:', err);
  }

  const payload = {
    videoId,
    title,
    isLive,
    channelHandle: '@nuevotiempotv',
    channelUrl: `https://www.youtube.com/watch?v=${videoId}`,
    recentStreams,
  };
  setCache('nt_live', payload, 3 * 60 * 1000);
  return payload;
}

async function resolveNuevoTiempoShorts() {
  const cached = getCache<typeof FALLBACK_SHORTS>('nt_shorts');
  if (cached) return cached;

  try {
    const html = await (
      await fetch('https://www.youtube.com/@nuevotiempotv/shorts', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es-ES,es;q=0.9' },
      })
    ).text();
    const ids = [...new Set([...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]))].slice(0, 8);
    if (ids.length >= 4) {
      const categories = ['Reflexion', 'Biblia', 'Jovenes', 'Testimonio', 'EscuelaSabatica', 'Musica'];
      const avatars = [
        '/src/assets/images/maranata_emblem_1794943377605.jpg',
        '/src/assets/images/creator_avatar_pastor_1794943379804.jpg',
        '/src/assets/images/creator_avatar_youth_1794943381952.jpg',
      ];
      const items = await Promise.all(
        ids.map(async (id, idx) => {
          const fallback = FALLBACK_SHORTS.find((f) => f.youtubeId === id);
          let title = fallback?.title || 'Mensaje Adventista de Esperanza';
          try {
            const oe = (await fetchJson(
              `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
            )) as { title?: string };
            if (oe.title) title = oe.title;
          } catch {
            // use fallback title
          }
          return {
            id,
            youtubeId: id,
            title,
            caption:
              fallback?.caption ||
              'Comparte este mensaje de fe y esperanza con tu iglesia y amigos en Maranata.',
            authorId: idx % 3 === 1 ? 'pr_daniel' : idx % 3 === 2 ? 'camila_jovenes' : 'nt_oficial',
            authorName:
              idx % 3 === 1
                ? 'Pr. Daniel Mendoza'
                : idx % 3 === 2
                  ? 'Camila Ríos'
                  : 'TV Nuevo Tiempo',
            authorHandle:
              idx % 3 === 1
                ? 'pr.danielmendoza'
                : idx % 3 === 2
                  ? 'camilarios.ja'
                  : 'nuevotiempotv',
            authorAvatar: avatars[idx % avatars.length],
            category: fallback?.category || categories[idx % categories.length],
          };
        })
      );
      const combined = [
        ...items,
        ...CURATED_ADVENTIST_VIDEOS.filter(
          (cv) => !items.some((it) => it.youtubeId === cv.youtubeId)
        ),
      ];
      setCache('nt_shorts', combined, 15 * 60 * 1000);
      return combined;
    }
  } catch (err) {
    console.error('Error fetching Shorts:', err);
  }

  return FALLBACK_SHORTS;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1. TV Nuevo Tiempo Live endpoint
  app.get('/api/tv/live', async (_req, res) => {
    try {
      const data = await resolveNuevoTiempoLive();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error loading TV live stream' });
    }
  });

  // 2. Social Shorts feed endpoint
  app.get('/api/videos/feed', async (_req, res) => {
    try {
      const items = await resolveNuevoTiempoShorts();
      res.json({ items });
    } catch {
      res.json({ items: FALLBACK_SHORTS });
    }
  });

  // Strict blocklist: NO secular songs AND NO reggaeton, salsa, cumbia, bachata, trap, urbano, rap, rock/metal, reggae, etc.
  const SECULAR_BLOCK_RE =
    /\b(reggaeton|reggaet[oó]n|reguet[oó]n|reggae|trap|perreo|dembow|corrido|corridos|norte[ñn]o|ranchera|mariachi|bachata|cumbia|salsa|vallenato|merengue|urbano|urbana|hip[\s-]?hop|rap|champeta|guaracha|phonk|nightcore|techno|tecno|edm|electr[oó]nica|hard rock|pop rock|rock cristiano|rock|heavy metal|metal cristiano|punk|ska|dj remix|club mix|remix|sertanejo|pagode|samba|forr[oó]|funk|k-?pop|reggaeton cristiano|salsa cristiana|cumbia cristiana|bachata cristiana|trap cristiano|rap cristiano|merengue cristiano|vallenato cristiano|urbano cristiano|reggae cristiano|redimi2|alex zurdo|funky|manny montes|almighty|vico c|indiomar|gabriel emc|musiko|rubinsky|madiel lara|jay kalyl|lizzy parra|ander bock|gilberto daza|onell diaz|farruko|rojo|vevo|sony music|universal music|warner music|bad bunny|karol g|j balvin|maluma|ozuna|anuel|rauw|shakira|feid|peso pluma|grupo firme|luis miguel|jose jose|juan gabriel|vicente fernandez|enrique iglesias|sin bandera|reik|jesse & joy|soda stereo|ricardo arjona|chayanne|marco antonio solis|los bukis|temerarios|daddy yankee|don omar|nicky jam|becky g|rosalia|sebastian yatra|morat|christian nodal|julion alvarez|natanael cano|fuerza regida|eslabon armado|romeo santos|marc anthony|luis fonsi|ricky martin|pitbull|manuel turizo|bizarrap|bzrp|juanes|carlos vives|alejandro sanz|alejandro fernandez|carin leon|banda ms|tigres del norte|canserbero|calle 13|residente|despacito|gasolina|bichota|provenza|discoteca|cantina|borracho|cerveza|desamor|infiel|free fire|minecraft|gameplay|telenovela|parodia)\b/i;

  const CHRISTIAN_RELEVANCE_RE =
    /(cristian|cristo|jesús|jesus|dios|señor|senor|espíritu|espiritu|alabanz|adoraci|himno|himnario|adventist|nuevo tiempo|grabadora|maranata|biblia|bíblic|biblic|gracia|gloria|aleluya|amén|amen|yeshua|jehová|jehova|salvador|redentor|pastor|iglesia|ministerio|evangelio|salmo|gospel|worship|cántico|cantico|fe\b|cielo|cruz|santo|santa|profec|devocional|witt|canzion|vástago|vastago|gándara|gandara|romero|goodman|montero|campos|clario|barak|tercer cielo|morillo|rosario|gateway|generación 12|generacion 12|brunet|oasis ministry|miel san marcos|un corazón|un corazon|arautos|heraldos|zimrah|dilson|barcelos|pinho|laura morena|lüdtke|ludtke|art'trio|cuarteto asaf|valença|valenca|fernanda lara|garibo|espinosa|mensaje music|primera fe|forgiven|adoradores|kike pavón|pavon|nancy amancio|ruth mixter|hillsong|bethel|elevation|en espíritu y en verdad|christine d)/i;

  const cleanYouTubeTitle = (raw: string): string =>
    raw
      .replace(/\s*[\[(](?:official\s*(?:music\s*)?video|video\s*oficial|clip\s*oficial|audio\s*oficial|en\s*español|lyric\s*video|con\s*letra|letra|lyrics?|hd|4k|en\s*vivo|live)[\])]/gi, '')
      .replace(/\s*\|\s*(?:video\s*oficial|official\s*video|música\s*cristiana|alabanza).*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

  // 2b. Search ONLY reverent Christian & Adventist videos & worship music
  app.get('/api/videos/search', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim().slice(0, 100);
    const searchType = req.query.type === 'music' ? 'music' : 'general';
    if (rawQuery.length < 2) return res.json({ items: [] });

    const lower = rawQuery.toLowerCase();
    if (SECULAR_BLOCK_RE.test(lower)) {
      return res.json({ items: [] });
    }

    let scopedQuery = rawQuery;
    if (searchType === 'music') {
      const hasExplicitChristianContext =
        /cristian|adventist|alabanz|adoraci|himno|himnario|nuevo tiempo|maranata|worship/.test(
          lower
        );
      scopedQuery = hasExplicitChristianContext ? rawQuery : `${rawQuery} alabanza adoracion cristiana`;
    } else {
      const hasContext =
        lower.includes('adventist') ||
        lower.includes('nuevo tiempo') ||
        lower.includes('maranata') ||
        lower.includes('cristian') ||
        lower.includes('biblia') ||
        lower.includes('predica');
      scopedQuery = hasContext ? rawQuery : `${rawQuery} adventista`;
    }

    const cacheKey = `yt_search_reverent_v4_${searchType}_${scopedQuery.toLowerCase()}`;
    const cached = getCache<Array<Record<string, unknown>>>(cacheKey);
    if (cached) return res.json({ items: cached });

    try {
      const html = await (
        await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(scopedQuery)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept-Language': 'es-ES,es;q=0.9',
            },
          }
        )
      ).text();

      const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
      const results: Array<{
        id: string;
        youtubeId: string;
        title: string;
        authorName: string;
        authorHandle: string;
        duration?: string;
        category: string;
      }> = [];

      if (match) {
        const data = JSON.parse(match[1]) as {
          contents?: {
            twoColumnSearchResultsRenderer?: {
              primaryContents?: {
                sectionListRenderer?: {
                  contents?: Array<{
                    itemSectionRenderer?: {
                      contents?: Array<{
                        videoRenderer?: {
                          videoId?: string;
                          title?: { runs?: Array<{ text?: string }> };
                          ownerText?: { runs?: Array<{ text?: string }> };
                          lengthText?: { simpleText?: string };
                        };
                      }>;
                    };
                  }>;
                };
              };
            };
          };
        };

        const sections =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
            ?.contents || [];
        const seen = new Set<string>();

        for (const sec of sections) {
          for (const item of sec?.itemSectionRenderer?.contents || []) {
            const vr = item.videoRenderer;
            if (!vr?.videoId || seen.has(vr.videoId)) continue;
            seen.add(vr.videoId);
            const rawTitle = (vr.title?.runs || []).map((r) => r.text || '').join('').trim();
            const title = cleanYouTubeTitle(rawTitle) || rawTitle;
            const author =
              (vr.ownerText?.runs || []).map((r) => r.text || '').join('').trim() ||
              'Música Cristiana';
            if (!title) continue;

            const combinedText = `${rawTitle} ${author}`;
            if (SECULAR_BLOCK_RE.test(combinedText)) continue;
            if (!CHRISTIAN_RELEVANCE_RE.test(combinedText)) continue;

            results.push({
              id: vr.videoId,
              youtubeId: vr.videoId,
              title,
              authorName: author,
              authorHandle: author.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'musica',
              duration: vr.lengthText?.simpleText,
              category: searchType === 'music' ? 'Alabanza Cristiana' : 'Reflexion',
            });
            if (results.length >= 20) break;
          }
          if (results.length >= 20) break;
        }
      }

      if (results.length > 0) {
        setCache(cacheKey, results, 10 * 60 * 1000);
      }
      res.json({ items: results });
    } catch {
      res.json({ items: [] });
    }
  });

  // 2c. Live Archive.org Christian MP3 Audio Search (strictly Christian/Adventist)
  app.get('/api/audio/search', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim().slice(0, 100);
    if (rawQuery.length < 2 || SECULAR_BLOCK_RE.test(rawQuery)) return res.json({ items: [] });

    const cacheKey = `audio_search_clean_v2_${rawQuery.toLowerCase()}`;
    const cached = getCache<Array<Record<string, unknown>>>(cacheKey);
    if (cached) return res.json({ items: cached });

    try {
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        `(${rawQuery}) AND (adventista OR cristiana OR cristiano OR himnario OR alabanza) AND mediatype:audio`
      )}&fl[]=identifier,title,creator&rows=4&output=json`;
      const searchData = (await fetchJson(searchUrl)) as {
        response?: { docs?: Array<{ identifier?: string; title?: string; creator?: string }> };
      };
      const docs = (searchData?.response?.docs || []).filter(
        (d) =>
          d.identifier &&
          !SECULAR_BLOCK_RE.test(`${d.title || ''} ${d.creator || ''}`)
      );

      const tracks: Array<{
        id: string;
        title: string;
        artist: string;
        album: string;
        playlist: string;
        durationSec: number;
        audioUrl: string;
        coverUrl: string;
      }> = [];

      await Promise.all(
        docs.slice(0, 4).map(async (docItem) => {
          const id = docItem.identifier!;
          try {
            const meta = (await fetchJson(`https://archive.org/metadata/${id}`)) as {
              files?: Array<{ name?: string; length?: string; title?: string; artist?: string }>;
            };
            const allFiles = meta.files || [];
            const mp3BaseNames = new Set(
              allFiles
                .filter((f) => f.name && f.name.toLowerCase().endsWith('.mp3'))
                .map((f) => f.name!.replace(/\.mp3$/i, '').toLowerCase())
            );
            const imageFiles = allFiles.filter((f) => {
              if (!f.name) return false;
              const lowerName = f.name.toLowerCase();
              if (
                lowerName.includes('_thumb') ||
                lowerName.includes('spectrogram') ||
                lowerName === '__ia_thumb.jpg'
              ) {
                return false;
              }
              const base = lowerName.replace(/\.(jpe?g|png|webp)$/i, '');
              if (lowerName.endsWith('.png') && mp3BaseNames.has(base)) {
                return false; // Archive.org auto-generated waveform PNG
              }
              return /\.(jpe?g|webp)$/i.test(lowerName) || /cover|front|folder|album|caratula/i.test(lowerName);
            });
            const preferredCover =
              imageFiles.find((f) => /cover|front|folder|album|caratula/i.test(f.name || '')) ||
              imageFiles[0];
            const itemCoverUrl = preferredCover?.name
              ? `https://archive.org/download/${id}/${encodeURIComponent(preferredCover.name)}`
              : '';

            const mp3s = allFiles.filter(
              (f) =>
                f.name &&
                f.name.toLowerCase().endsWith('.mp3') &&
                !f.name.toLowerCase().endsWith('_64kb.mp3')
            );
            for (const f of mp3s.slice(0, 6)) {
              const rawName = f.name!;
              const cleanTitle = (
                f.title ||
                rawName.replace(/\.mp3$/i, '').replace(/^\d+[\s._-]+/, '')
              ).trim();
              let parsedDuration = 220;
              if (f.length) {
                if (f.length.includes(':')) {
                  const parts = f.length.split(':').map((p) => Number(p));
                  if (parts.length === 2 && parts.every(Number.isFinite)) {
                    parsedDuration = parts[0] * 60 + parts[1];
                  } else if (parts.length === 3 && parts.every(Number.isFinite)) {
                    parsedDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
                  }
                } else {
                  const n = Number(f.length);
                  if (Number.isFinite(n) && n > 0) parsedDuration = n;
                }
              }
              tracks.push({
                id: `ar_${id}_${rawName}`,
                title: cleanTitle || docItem.title || 'Alabanza Cristiana',
                artist: f.artist || docItem.creator || 'Música Cristiana',
                album: docItem.title || 'Colección Cristiana',
                playlist: 'Adoracion',
                durationSec: Math.max(45, Math.round(parsedDuration)),
                audioUrl: `https://archive.org/download/${id}/${encodeURIComponent(rawName)}`,
                coverUrl: itemCoverUrl,
              });
            }
          } catch {
            // skip item metadata error
          }
        })
      );

      setCache(cacheKey, tracks.slice(0, 24), 10 * 60 * 1000);
      res.json({ items: tracks.slice(0, 24) });
    } catch {
      res.json({ items: [] });
    }
  });

  // 2d. Complete Adventist Hymnal Endpoints (Himnario Nuevo 2009 + Himnario Antiguo 1962 + Lyrics)
  const parseHymnDuration = (len?: string): number => {
    if (!len) return 180;
    if (len.includes(':')) {
      const parts = len.split(':').map((p) => Number(p));
      if (parts.length === 2 && parts.every(Number.isFinite)) {
        return Math.max(40, Math.round(parts[0] * 60 + parts[1]));
      }
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        return Math.max(40, Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]));
      }
    }
    const n = Number(len);
    return Number.isFinite(n) && n > 0 ? Math.max(40, Math.round(n)) : 180;
  };

  const normalizeHymnTitle = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  async function getClaudioLyricsIndex(): Promise<
    Array<{ number: number; title: string; path: string }>
  > {
    const cacheKey = 'claudio_hymns_tree_v1';
    const cached = getCache<Array<{ number: number; title: string; path: string }>>(cacheKey);
    if (cached) return cached;

    const treeData = (await fetchJson(
      'https://api.github.com/repos/Claudio-Osorio/himnario-adventista/git/trees/main'
    )) as { tree?: Array<{ path?: string; type?: string }> };

    const entries: Array<{ number: number; title: string; path: string }> = [];
    for (const item of treeData.tree || []) {
      if (item.type !== 'blob' || !item.path || !item.path.endsWith('.txt')) continue;
      const m = item.path.match(/^(\d+)\s*-\s*Himno\s*#\d+\s+(.+)\.txt$/i);
      if (m) {
        entries.push({
          number: Number(m[1]),
          title: m[2].trim(),
          path: item.path,
        });
      }
    }
    entries.sort((a, b) => a.number - b.number);
    setCache(cacheKey, entries, 24 * 60 * 60 * 1000);
    return entries;
  }

  async function getHymnCorrelationMap(): Promise<{
    antiguoToNuevo: Record<number, number>;
    nuevoToAntiguo: Record<number, number>;
  }> {
    const cacheKey = 'hymn_corr_1962_2009_v1';
    const cached = getCache<{
      antiguoToNuevo: Record<number, number>;
      nuevoToAntiguo: Record<number, number>;
    }>(cacheKey);
    if (cached) return cached;

    const jsText = await (
      await fetch('https://raw.githubusercontent.com/bellaciaodowhile/himnario-1962-2009/main/Hymns.js')
    ).text();
    const jsonStr = jsText
      .replace(/^[\s\S]*?const\s+HimnarioCompletoMasCorrelacion\s*=\s*/, '')
      .replace(/;\s*$/, '');
    const rows = JSON.parse(jsonStr) as Array<{
      HimnarioNuevo?: { number?: number | string | false };
      HimnarioAntiguo?: { number?: number | string | false };
    }>;

    const antiguoToNuevo: Record<number, number> = {};
    const nuevoToAntiguo: Record<number, number> = {};
    for (const row of rows) {
      const nNew = Number(row.HimnarioNuevo?.number);
      const nOld = Number(row.HimnarioAntiguo?.number);
      if (Number.isFinite(nNew) && nNew > 0 && Number.isFinite(nOld) && nOld > 0) {
        if (!antiguoToNuevo[nOld]) antiguoToNuevo[nOld] = nNew;
        if (!nuevoToAntiguo[nNew]) nuevoToAntiguo[nNew] = nOld;
      }
    }
    const result = { antiguoToNuevo, nuevoToAntiguo };
    setCache(cacheKey, result, 24 * 60 * 60 * 1000);
    return result;
  }

  const cleanDisplayHymnTitle = (raw: string): string => {
    let s = raw
      .replace(/^HA\s*62\s*(Himno\s*)?\d*\s*[-·.]?\s*/i, '')
      .replace(/^Himno\s*#?\d*\s*[-·.]?\s*/i, '')
      .replace(/^0*\d{1,3}\s*[-·.]?\s*/, '')
      .replace(/¡\s+/g, '¡')
      .replace(/¿\s+/g, '¿')
      .replace(/\s+!/g, '!')
      .replace(/\s+\?/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return 'Himno Adventista';
    // Sentence-friendly capitalization if all lowercase or all uppercase
    if (s === s.toUpperCase() || s === s.toLowerCase()) {
      s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }
    return s;
  };

  app.get('/api/hymns/catalog', async (req, res) => {
    const edition = req.query.edition === 'antiguo' ? 'antiguo' : 'nuevo';
    const cacheKey = `hymns_catalog_${edition}_v2`;
    const cached = getCache<Array<Record<string, unknown>>>(cacheKey);
    if (cached) return res.json({ items: cached });

    try {
      if (edition === 'nuevo') {
        const meta = (await fetchJson('https://archive.org/metadata/ha2010/files')) as {
          result?: Array<{ name?: string; title?: string; length?: string }>;
        };
        const mp3s = (meta.result || []).filter(
          (f) => f.name && f.name.toLowerCase().endsWith('.mp3')
        );
        const items = mp3s
          .map((f) => {
            const rawName = f.name!;
            const numMatch = (f.title || rawName).match(/^0*(\d{1,3})\b/);
            const num = numMatch ? Number(numMatch[1]) : 0;
            const rawTitle = cleanDisplayHymnTitle(f.title || rawName.replace(/\.mp3$/i, ''));
            return {
              id: `hn_${num || rawName}`,
              hymnNumber: num || undefined,
              hymnEdition: 'nuevo' as const,
              title: rawTitle,
              artist: 'Himnario Adventista',
              album: 'Edición 2009 · Himnario Nuevo',
              playlist: 'Himnario' as const,
              durationSec: parseHymnDuration(f.length),
              audioUrl: `https://archive.org/download/ha2010/${encodeURIComponent(rawName)}`,
              coverUrl: '',
            };
          })
          .sort((a, b) => (a.hymnNumber || 9999) - (b.hymnNumber || 9999));

        setCache(cacheKey, items, 24 * 60 * 60 * 1000);
        return res.json({ items });
      }

      // Himnario Antiguo (1962)
      const searchUrl =
        'https://archive.org/advancedsearch.php?q=identifier:ha-62-himno-*&fl[]=identifier,title&rows=950&output=json';
      const data = (await fetchJson(searchUrl)) as {
        response?: { docs?: Array<{ identifier?: string; title?: string }> };
      };
      const docs = data?.response?.docs || [];
      const byNum = new Map<
        number,
        { identifier: string; title: string; num: number; has2026: boolean }
      >();

      for (const d of docs) {
        if (!d.identifier) continue;
        const m = d.identifier.match(/^ha-62-himno-(\d+)-/i);
        if (!m) continue;
        const num = Number(m[1]);
        const has2026 = d.identifier.endsWith('_202609');
        const cleanTitle = cleanDisplayHymnTitle(d.title || d.identifier);
        const prev = byNum.get(num);
        if (!prev || (!prev.has2026 && has2026)) {
          byNum.set(num, {
            identifier: d.identifier,
            title: cleanTitle || `Himno ${num}`,
            num,
            has2026,
          });
        }
      }

      const items = [...byNum.values()]
        .sort((a, b) => a.num - b.num)
        .map((entry) => ({
          id: `ha_${entry.num}`,
          hymnNumber: entry.num,
          hymnEdition: 'antiguo' as const,
          archiveIdentifier: entry.identifier,
          title: entry.title,
          artist: 'Himnario Adventista',
          album: 'Edición 1962 · Himnario Antiguo',
          playlist: 'Himnario' as const,
          durationSec: 165,
          audioUrl: '',
          coverUrl: '',
        }));

      setCache(cacheKey, items, 24 * 60 * 60 * 1000);
      res.json({ items });
    } catch {
      res.json({ items: [] });
    }
  });

  app.get('/api/hymns/resolve', async (req, res) => {
    const identifier = String(req.query.identifier || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!identifier) return res.status(400).json({ error: 'identifier requerido' });

    const cacheKey = `hymn_resolve_${identifier}`;
    const cached = getCache<{ audioUrl: string; durationSec: number }>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const meta = (await fetchJson(`https://archive.org/metadata/${identifier}/files`)) as {
        result?: Array<{ name?: string; length?: string }>;
      };
      const mp3 = (meta.result || []).find((f) => f.name && f.name.toLowerCase().endsWith('.mp3'));
      if (!mp3?.name) {
        return res.status(404).json({ error: 'Audio no encontrado' });
      }
      const resolved = {
        audioUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(mp3.name)}`,
        durationSec: parseHymnDuration(mp3.length),
      };
      setCache(cacheKey, resolved, 24 * 60 * 60 * 1000);
      res.json(resolved);
    } catch {
      res.status(502).json({ error: 'Error resolviendo audio del himno' });
    }
  });

  app.get('/api/hymns/lyrics', async (req, res) => {
    const edition = req.query.edition === 'antiguo' ? 'antiguo' : 'nuevo';
    const rawNum = Number(req.query.number || 0);
    const rawTitle = String(req.query.title || '').trim();
    if (!rawNum && !rawTitle) {
      return res.json({ found: false, lyrics: '' });
    }

    const cacheKey = `hymn_lyrics_${edition}_${rawNum}_${normalizeHymnTitle(rawTitle).slice(0, 40)}`;
    const cached = getCache<Record<string, unknown>>(cacheKey);
    if (cached) return res.json(cached);

    try {
      const entries = await getClaudioLyricsIndex();
      let targetEntry: { number: number; title: string; path: string } | undefined;

      if (edition === 'nuevo' && rawNum > 0) {
        targetEntry = entries.find((e) => e.number === rawNum);
      } else if (edition === 'antiguo' && rawNum > 0) {
        try {
          const { antiguoToNuevo } = await getHymnCorrelationMap();
          const mappedNuevo = antiguoToNuevo[rawNum];
          if (mappedNuevo) {
            targetEntry = entries.find((e) => e.number === mappedNuevo);
          }
        } catch {
          // fallback to title matching
        }
      }

      if (!targetEntry && rawTitle) {
        const cleanTarget = normalizeHymnTitle(
          rawTitle.replace(/^Himno\s*\d+\s*[-·]?\s*/i, '')
        );
        if (cleanTarget.length >= 4) {
          targetEntry = entries.find((e) => {
            const normEntry = normalizeHymnTitle(e.title);
            return normEntry === cleanTarget || normEntry.includes(cleanTarget) || cleanTarget.includes(normEntry);
          });
        }
      }

      if (!targetEntry) {
        return res.json({ found: false, lyrics: '' });
      }

      const rawText = await (
        await fetch(
          `https://raw.githubusercontent.com/Claudio-Osorio/himnario-adventista/main/${encodeURIComponent(
            targetEntry.path
          )}`
        )
      ).text();

      const lines = rawText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter((_, idx) => idx > 0); // skip first redundant "Himno #N ..." header line

      const formattedLyrics = lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const result = {
        found: true,
        title: targetEntry.title,
        hymnNumber: rawNum || targetEntry.number,
        correlatedNumber: edition === 'antiguo' ? targetEntry.number : undefined,
        lyrics: formattedLyrics,
      };
      setCache(cacheKey, result, 24 * 60 * 60 * 1000);
      res.json(result);
    } catch {
      res.json({ found: false, lyrics: '' });
    }
  });

  // 3. Bible API endpoints (Bolls Life proxy)
  app.get('/api/bible/versions', (_req, res) => {
    res.json({ versions: SPANISH_BIBLE_VERSIONS });
  });

  app.get('/api/bible/books/:version', async (req, res) => {
    const version = req.params.version.replace(/[^a-zA-Z0-9]/g, '') || 'RV1960';
    const cacheKey = `bible_books_${version}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const books = await fetchJson(`https://bolls.life/get-books/${version}/`);
      setCache(cacheKey, books, 24 * 60 * 60 * 1000);
      res.json(books);
    } catch (error) {
      res.status(502).json({ error: 'No se pudieron cargar los libros bíblicos' });
    }
  });

  app.get('/api/bible/chapter/:version/:book/:chapter', async (req, res) => {
    const version = req.params.version.replace(/[^a-zA-Z0-9]/g, '') || 'RV1960';
    const book = Number(req.params.book);
    const chapter = Number(req.params.chapter);
    if (!Number.isInteger(book) || book < 1 || book > 66 || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
      return res.status(400).json({ error: 'Libro o capítulo inválido' });
    }

    const cacheKey = `bible_ch_${version}_${book}_${chapter}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const raw = (await fetchJson(`https://bolls.life/get-chapter/${version}/${book}/${chapter}/`)) as Array<{
        pk: number;
        verse: number;
        text: string;
      }>;
      const verses = raw.map((v) => ({
        pk: v.pk,
        verse: v.verse,
        text: stripHtmlTags(v.text),
      }));
      setCache(cacheKey, verses, 12 * 60 * 60 * 1000);
      res.json(verses);
    } catch (error) {
      res.status(502).json({ error: 'No se pudo cargar el capítulo en esta versión' });
    }
  });

  app.get('/api/bible/search/:version', async (req, res) => {
    const version = req.params.version.replace(/[^a-zA-Z0-9]/g, '') || 'RV1960';
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json([]);

    try {
      const url = `https://bolls.life/v2/find/${version}?search=${encodeURIComponent(query)}&match_case=false&match_whole=false&limit=25&page=1`;
      const data = (await fetchJson(url)) as { results?: Array<{ book: number; chapter: number; verse: number; text: string }> } | Array<{ book: number; chapter: number; verse: number; text: string }>;
      const list = Array.isArray(data) ? data : data.results || [];
      res.json(
        list.slice(0, 25).map((r) => ({
          book: r.book,
          chapter: r.chapter,
          verse: r.verse,
          text: stripHtmlTags(r.text),
        }))
      );
    } catch {
      res.json([]);
    }
  });

  // 4. Sabbath School Official Adventech API v2 Proxy (Spanish)
  app.get('/api/sabbath-school/quarterlies', async (_req, res) => {
    const cacheKey = 'ss_quarterlies_es';
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const data = await fetchJson('https://sabbath-school.adventech.io/api/v2/es/quarterlies/index.json');
      setCache(cacheKey, data, 60 * 60 * 1000);
      res.json(data);
    } catch {
      res.status(502).json({ error: 'No se pudieron cargar los trimestrales de Escuela Sabática' });
    }
  });

  app.get('/api/sabbath-school/quarterly/:id', async (req, res) => {
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const cacheKey = `ss_q_${id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const data = await fetchJson(`https://sabbath-school.adventech.io/api/v2/es/quarterlies/${id}/index.json`);
      setCache(cacheKey, data, 60 * 60 * 1000);
      res.json(data);
    } catch {
      res.status(502).json({ error: 'No se pudo cargar el trimestral' });
    }
  });

  app.get('/api/sabbath-school/lesson/:quarterlyId/:lessonId', async (req, res) => {
    const quarterlyId = req.params.quarterlyId.replace(/[^a-zA-Z0-9_-]/g, '');
    const lessonId = req.params.lessonId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cacheKey = `ss_l_${quarterlyId}_${lessonId}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const data = await fetchJson(
        `https://sabbath-school.adventech.io/api/v2/es/quarterlies/${quarterlyId}/lessons/${lessonId}/index.json`
      );
      setCache(cacheKey, data, 60 * 60 * 1000);
      res.json(data);
    } catch {
      res.status(502).json({ error: 'No se pudo cargar la lección' });
    }
  });

  app.get('/api/sabbath-school/day/:quarterlyId/:lessonId/:dayId', async (req, res) => {
    const quarterlyId = req.params.quarterlyId.replace(/[^a-zA-Z0-9_-]/g, '');
    const lessonId = req.params.lessonId.replace(/[^a-zA-Z0-9_-]/g, '');
    const dayId = req.params.dayId.replace(/[^a-zA-Z0-9_-]/g, '');
    const cacheKey = `ss_d_${quarterlyId}_${lessonId}_${dayId}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const data = await fetchJson(
        `https://sabbath-school.adventech.io/api/v2/es/quarterlies/${quarterlyId}/lessons/${lessonId}/days/${dayId}/read/index.json`
      );
      setCache(cacheKey, data, 60 * 60 * 1000);
      res.json(data);
    } catch {
      res.status(502).json({ error: 'No se pudo cargar la lectura del día' });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Maranata server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
