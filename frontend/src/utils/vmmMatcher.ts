export interface VideotecaVideo {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail_url?: string;
}

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'y', 'en', 'un', 'una', 'unos', 'unas',
  'por', 'para', 'con', 'sin', 'sobre', 'tras', 'durante', 'mediante',
  'mp4', 'docx', 'doc', 'pdf', '1080p', '720p', 'vimeo', 'drive', 'clase', 'modulo'
]);

/**
 * Normaliza una cadena para comparación flexible:
 * - Quita extensiones de archivo
 * - Quita acentos y diacríticos
 * - Quita ceros iniciales en números (ej: "01" -> "1", "002" -> "2")
 * - Convierte a minúsculas y elimina símbolos
 */
export function cleanStringForMatching(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .trim()
    // Quitar extensiones al final
    .replace(/\.(mp4|mp1|mov|avi|mkv|webm|docx?|pdf)$/i, '')
    // Descomponer acentos
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Reemplazar ceros a la izquierda en números aislados (ej: "01" -> "1")
    .replace(/\b0+([1-9]\d*)\b/g, "$1")
    // Reemplazar todo lo que no sea letra o número por espacio
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae tokens (palabras clave) significativos de una cadena
 */
export function extractTokens(str: string): string[] {
  const clean = cleanStringForMatching(str);
  if (!clean) return [];
  
  return clean
    .split(' ')
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Calcula un puntaje de similitud (0.0 a 1.0) entre dos cadenas usando coincidencia de tokens
 */
export function calculateMatchScore(targetStr: string, candidateStr: string): number {
  const targetClean = cleanStringForMatching(targetStr);
  const candidateClean = cleanStringForMatching(candidateStr);
  
  if (!targetClean || !candidateClean) return 0;
  
  // 1. Coincidencia exacta limpia
  if (targetClean === candidateClean) return 1.0;
  
  // 2. Coincidencia si una cadena está contenida íntegramente en la otra
  if (targetClean.length >= 5 && candidateClean.length >= 5) {
    if (targetClean.includes(candidateClean) || candidateClean.includes(targetClean)) {
      return 0.9;
    }
  }

  // 3. Coincidencia por tokens (palabras clave)
  const tokensTarget = extractTokens(targetStr);
  const tokensCandidate = extractTokens(candidateStr);

  if (tokensTarget.length === 0 || tokensCandidate.length === 0) return 0;

  let commonCount = 0;
  let hasLongKeyWordMatch = false;

  for (const t of tokensTarget) {
    if (tokensCandidate.includes(t)) {
      commonCount++;
      if (t.length >= 6) {
        hasLongKeyWordMatch = true;
      }
    } else {
      // Probar si el token del target está contenido en algún token del candidato
      for (const c of tokensCandidate) {
        if ((t.length >= 5 && c.includes(t)) || (c.length >= 5 && t.includes(c))) {
          commonCount += 0.8;
          if (t.length >= 6 || c.length >= 6) hasLongKeyWordMatch = true;
          break;
        }
      }
    }
  }

  const minTokensCount = Math.min(tokensTarget.length, tokensCandidate.length);
  const overlapRatio = commonCount / minTokensCount;

  // Si hay una palabra clave distintiva larga (ej: "institucionalidad", "metodologia") y al menos 50% de coincidencia
  if (hasLongKeyWordMatch && overlapRatio >= 0.4) {
    return 0.85;
  }

  if (overlapRatio >= 0.6) {
    return 0.75;
  }

  return 0;
}

/**
 * Encuentra el mejor video de VMM que coincida con el nombre objetivo (Drive MM, links o descripción).
 */
export function findBestVmmMatch(
  targetName: string,
  vmmVideos: VideotecaVideo[],
  descripcionClase?: string
): VideotecaVideo | null {
  if ((!targetName && !descripcionClase) || !vmmVideos || vmmVideos.length === 0) return null;

  // Desglosar candidates de targetName si contiene '|'
  const targetCandidates = targetName ? (targetName.includes('|') ? targetName.split('|').map(p => p.trim()) : [targetName]) : [];
  if (descripcionClase) {
    targetCandidates.push(descripcionClase);
  }

  let bestVideo: VideotecaVideo | null = null;
  let highestScore = 0;

  for (const candidate of targetCandidates) {
    if (!candidate) continue;

    for (const video of vmmVideos) {
      const scoreTitle = calculateMatchScore(candidate, video.title);
      const scoreDesc = video.description ? calculateMatchScore(candidate, video.description) * 0.9 : 0;
      const score = Math.max(scoreTitle, scoreDesc);

      if (score > highestScore && score >= 0.7) {
        highestScore = score;
        bestVideo = video;
      }
    }
  }

  return bestVideo;
}
