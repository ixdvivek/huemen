import { toPng } from 'html-to-image';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

async function renderPng(node: HTMLElement, pixelRatio: number) {
  await document.fonts.ready;
  // The card is centred with `margin: auto` on wide screens. html-to-image copies that
  // margin onto the clone, which pushes the content right and crops it — so zero it
  // and pin the exact size.
  const opts = {
    pixelRatio,
    cacheBust: true,
    backgroundColor: '#F3F2EF',
    width: node.offsetWidth,
    height: node.offsetHeight,
    style: { margin: '0', transform: 'none' },
  };
  // Safari sometimes drops images/fonts on the first pass — render twice.
  if (isSafari) await toPng(node, opts);
  return toPng(node, opts);
}

async function dataUrlToBlob(url: string) {
  return (await fetch(url)).blob();
}

async function deliver(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: blob.type });
  const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (canShareFiles && isTouch) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared' as const;
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled' as const;
      // fall through to download
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded' as const;
}

export async function shareAsImage(node: HTMLElement, filename: string, title: string) {
  const png = await renderPng(node, 3);
  return deliver(await dataUrlToBlob(png), `${filename}.png`, title);
}

export async function shareAsPdf(node: HTMLElement, filename: string, title: string) {
  const { jsPDF } = await import('jspdf');
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const png = await renderPng(node, 3);
  // One tall page the exact size of the card — reads like the image on a phone.
  const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: h >= w ? 'portrait' : 'landscape', compress: true });
  pdf.addImage(png, 'PNG', 0, 0, w, h, undefined, 'FAST');
  pdf.setProperties({ title });
  return deliver(pdf.output('blob'), `${filename}.pdf`, title);
}
