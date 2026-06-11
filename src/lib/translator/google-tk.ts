/**
 * Google Translate TK hash algorithm — reverse-engineered from Google's web interface.
 * Ported from immersive-translate's GoogleHelper.
 *
 * TKK value is periodically rotated by Google; may need updating if requests fail.
 */
const TKK = '448487.932609646';

function shiftLeftOrRightThenSumOrXor(num: number, optString: string): number {
  for (let i = 0; i < optString.length - 2; i += 3) {
    let acc: number;
    const ch = optString.charAt(i + 2);
    if ('a' <= ch) {
      acc = ch.charCodeAt(0) - 87;
    } else {
      acc = Number(ch);
    }
    if (optString.charAt(i + 1) === '+') {
      acc = num >>> acc;
    } else {
      acc = num << acc;
    }
    if (optString.charAt(i) === '+') {
      num += acc & 4294967295;
    } else {
      num ^= acc;
    }
  }
  return num;
}

function transformQuery(query: string): number[] {
  const bytesArray: number[] = [];
  let idx = 0;
  for (let i = 0; i < query.length; i++) {
    let charCode = query.charCodeAt(i);

    if (128 > charCode) {
      bytesArray[idx++] = charCode;
    } else {
      if (2048 > charCode) {
        bytesArray[idx++] = (charCode >> 6) | 192;
      } else {
        if (
          55296 === (charCode & 64512) &&
          i + 1 < query.length &&
          56320 === (query.charCodeAt(i + 1) & 64512)
        ) {
          charCode = 65536 + ((charCode & 1023) << 10) + (query.charCodeAt(++i) & 1023);
          bytesArray[idx++] = (charCode >> 18) | 240;
          bytesArray[idx++] = ((charCode >> 12) & 63) | 128;
        } else {
          bytesArray[idx++] = (charCode >> 12) | 224;
        }
        bytesArray[idx++] = ((charCode >> 6) & 63) | 128;
      }
      bytesArray[idx++] = (charCode & 63) | 128;
    }
  }
  return bytesArray;
}

/** Calculate Google Translate TK hash for a query string */
export function calcHash(query: string): string {
  const tkkSplited = TKK.split('.');
  const tkkIndex = Number(tkkSplited[0]) || 0;
  const tkkKey = Number(tkkSplited[1]) || 0;

  const bytesArray = transformQuery(query);

  let encondingRound = tkkIndex;
  for (const item of bytesArray) {
    encondingRound += item;
    encondingRound = shiftLeftOrRightThenSumOrXor(encondingRound, '+-a^+6');
  }
  encondingRound = shiftLeftOrRightThenSumOrXor(encondingRound, '+-3^+b+-f');

  encondingRound ^= tkkKey;
  if (encondingRound <= 0) {
    encondingRound = (encondingRound & 2147483647) + 2147483648;
  }

  const normalizedResult = encondingRound % 1000000;
  return normalizedResult.toString() + '.' + (normalizedResult ^ tkkIndex);
}
