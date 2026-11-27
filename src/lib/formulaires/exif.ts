/**
 * Lecture minimale des métadonnées EXIF d'une photo JPEG : position GPS et
 * date de prise de vue. Sert aux photos choisies dans la galerie du
 * téléphone, dont la position n'est pas celle du téléphone au moment de
 * l'envoi. Renvoie null si la photo n'a pas d'EXIF (ou n'est pas un JPEG).
 */
export type ExifPhoto = { latitude: number | null; longitude: number | null; date: string | null };

export async function lireExif(fichier: Blob): Promise<ExifPhoto | null> {
  try {
    const vue = new DataView(await fichier.slice(0, 256 * 1024).arrayBuffer());
    if (vue.getUint16(0) !== 0xffd8) return null; // pas un JPEG
    let pos = 2;
    while (pos + 4 < vue.byteLength) {
      const marqueur = vue.getUint16(pos);
      const longueur = vue.getUint16(pos + 2);
      // APP1 « Exif\0\0 »
      if (marqueur === 0xffe1 && vue.getUint32(pos + 4) === 0x45786966) return lireTiff(vue, pos + 10);
      if ((marqueur & 0xff00) !== 0xff00) return null;
      pos += 2 + longueur;
    }
    return null;
  } catch {
    return null;
  }
}

function lireTiff(vue: DataView, debut: number): ExifPhoto | null {
  const le = vue.getUint16(debut) === 0x4949; // « II » = petit-boutiste
  const u16 = (o: number) => vue.getUint16(debut + o, le);
  const u32 = (o: number) => vue.getUint32(debut + o, le);

  /** Entrées d'un répertoire (IFD) : étiquette → position de la valeur, type, nombre. */
  const ifd = (o: number) => {
    const entrees = new Map<number, { type: number; nombre: number; valeur: number }>();
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      const type = u16(e + 2);
      const nombre = u32(e + 4);
      const taille = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[type] ?? 1;
      entrees.set(u16(e), { type, nombre, valeur: taille * nombre > 4 ? u32(e + 8) : e + 8 });
    }
    return entrees;
  };
  const texte = (e?: { nombre: number; valeur: number }) => {
    if (!e) return null;
    let s = "";
    for (let i = 0; i < e.nombre - 1; i++) s += String.fromCharCode(vue.getUint8(debut + e.valeur + i));
    return s;
  };
  const rationnels = (e?: { nombre: number; valeur: number }) => {
    if (!e) return null;
    const r: number[] = [];
    for (let i = 0; i < e.nombre; i++) {
      const den = u32(e.valeur + 8 * i + 4);
      r.push(den ? u32(e.valeur + 8 * i) / den : 0);
    }
    return r;
  };
  const degres = (v: number[] | null, ref: string | null, negatif: string) =>
    v && v.length >= 3 ? (v[0] + v[1] / 60 + v[2] / 3600) * (ref === negatif ? -1 : 1) : null;

  if (u16(2) !== 42) return null;
  const ifd0 = ifd(u32(4));
  const gpsPtr = ifd0.get(0x8825);
  const exifPtr = ifd0.get(0x8769);

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (gpsPtr) {
    const gps = ifd(u32(gpsPtr.valeur));
    latitude = degres(rationnels(gps.get(2)), texte(gps.get(1)), "S");
    longitude = degres(rationnels(gps.get(4)), texte(gps.get(3)), "W");
    if (latitude === 0 && longitude === 0) latitude = longitude = null;
  }
  let date: string | null = null;
  const brute = exifPtr ? texte(ifd(u32(exifPtr.valeur)).get(0x9003)) : texte(ifd0.get(0x0132));
  const m = brute?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (m) date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).toISOString();
  return { latitude, longitude, date };
}
